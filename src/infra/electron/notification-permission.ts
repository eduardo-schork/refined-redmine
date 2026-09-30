import { app, Notification, shell } from 'electron'
import { execFile, execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import type { MonitorStateRepository } from '@application/ports/repositories'
import type { NotificationPermissionProbe } from '@application/ports/system'
import { resolvePermission, type AppCopy, type NotifyPermissionInfo } from '@domain/notification/permission'
import { escapeRegex } from '@domain/shared/text'

const isMac = process.platform === 'darwin'

type PermissionBase = Pick<NotifyPermissionInfo, 'bundleId' | 'signed' | 'dev'>

/** The executable lives at `<App>.app/Contents/MacOS/<name>`. */
function appContentsPath(): string {
    return dirname(dirname(app.getPath('exe')))
}

function appBundlePath(): string {
    return dirname(appContentsPath())
}

/** Keys come in alphabetical order: "auth" comes right before "bundle-id". */
function notificationCenterEntryPattern(bundleId: string): RegExp {
    const authPart = '(?:<key>auth</key>\\s*<integer>(\\d+)</integer>\\s*)?'
    const bundlePart = `<key>bundle-id</key>\\s*<string>${escapeRegex(bundleId)}</string>`
    return new RegExp(authPart + bundlePart)
}

/**
 * Electron does not expose the notification permission, so the evidence is gathered here and judged by
 * `resolvePermission`. On macOS the Notification Center record (com.apple.ncprefs) is read when present;
 * on macOS 26 ad-hoc signed apps often do not show up there, and the usernoted database is protected.
 */
export class DesktopNotificationPermission implements NotificationPermissionProbe {
    private bundle: string | undefined | null = null

    constructor(
        private readonly state: MonitorStateRepository,
        private readonly appCopy: AppCopy
    ) {}

    private bundleId(): string | undefined {
        if (!isMac) return undefined
        if (this.bundle !== null) return this.bundle
        try {
            const plist = join(appContentsPath(), 'Info.plist')
            const output = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', plist], {
                encoding: 'utf8'
            })
            this.bundle = output.trim()
        } catch {
            this.bundle = undefined
        }
        return this.bundle
    }

    private isSigned(): boolean {
        if (!isMac) return true
        try {
            execFileSync('/usr/bin/codesign', ['-v', appBundlePath()], { stdio: 'ignore' })
            return true
        } catch {
            return false
        }
    }

    /** null = not registered; undefined = could not be read. */
    private notificationCenterAuth(bundleId: string): Promise<number | null | undefined> {
        return new Promise((resolve) => {
            execFile(
                '/usr/bin/defaults',
                ['export', 'com.apple.ncprefs', '-'],
                { maxBuffer: 20 * 1024 * 1024 },
                (error, xml) => {
                    if (error) {
                        resolve(undefined)
                        return
                    }
                    const match = xml.match(notificationCenterEntryPattern(bundleId))
                    if (!match) {
                        resolve(null)
                        return
                    }
                    const auth = match[1]
                    resolve(auth === undefined ? undefined : Number(auth))
                }
            )
        })
    }

    async check(): Promise<NotifyPermissionInfo> {
        const base: PermissionBase = { bundleId: this.bundleId(), signed: this.isSigned(), dev: !app.isPackaged }
        const bundleId = base.bundleId
        const canReadNotificationCenter = isMac && base.signed && bundleId !== undefined
        const auth = canReadNotificationCenter ? await this.notificationCenterAuth(bundleId) : undefined
        const verdict = resolvePermission({
            supported: Notification.isSupported(),
            isMac,
            signed: base.signed,
            notificationCenterAuth: typeof auth === 'number' ? auth : undefined,
            lastDelivery: this.state.getDelivery(),
            confirmation: this.state.getConfirmation(),
            app: this.appCopy
        })
        return { ...base, ...verdict }
    }

    async openSettings(): Promise<void> {
        if (!isMac) return shell.openExternal('ms-settings:notifications')
        const bundleId = this.bundleId()
        const query = bundleId ? `?id=${encodeURIComponent(bundleId)}` : ''
        await shell.openExternal(`x-apple.systempreferences:com.apple.Notifications-Settings.extension${query}`)
    }
}
