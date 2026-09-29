import { app, Notification, shell } from 'electron'
import { execFile, execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import type { MonitorStateRepository } from '@application/ports/repositories'
import type { NotificationPermissionProbe } from '@application/ports/system'
import type { NotifyPermissionInfo } from '@domain/notification/permission'
import { escapeRegex } from '@domain/shared/text'

const isMac = process.platform === 'darwin'
const ALERTS_AUTH_BIT = 4

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

function permissionFromAuth(base: PermissionBase, auth: number): NotifyPermissionInfo {
    const alertsAllowed = (auth & ALERTS_AUTH_BIT) !== 0
    if (!alertsAllowed) return { ...base, status: 'denied', reason: 'alertsOff' }
    return { ...base, status: 'granted' }
}

/**
 * Electron does not expose the macOS notification permission. We combine:
 * 1. The Notification Center record (com.apple.ncprefs), when present. `auth` is the bitmask of what
 *    the user authorized (1 = badge, 2 = sound, 4 = alerts). On macOS 26, ad-hoc signed apps
 *    (like the dev Electron) do not show up there, and the usernoted database is protected.
 * 2. The last actual delivery result (persisted): 'show' = delivered, 'failed' = refused.
 */
export class DesktopNotificationPermission implements NotificationPermissionProbe {
    private bundle: string | undefined | null = null

    constructor(private readonly state: MonitorStateRepository) {}

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
        if (!Notification.isSupported()) return { ...base, status: 'unsupported', reason: 'unsupported' }

        const lastDelivery = this.state.getDelivery()
        if (lastDelivery && !lastDelivery.ok) {
            return { ...base, status: 'denied', reason: 'refused', detail: lastDelivery.detail }
        }
        if (!isMac) return { ...base, status: 'granted' }
        if (!base.signed) return { ...base, status: 'denied', reason: 'unsigned' }

        const auth = base.bundleId ? await this.notificationCenterAuth(base.bundleId) : undefined
        if (typeof auth === 'number') return permissionFromAuth(base, auth)
        return { ...base, status: lastDelivery?.ok ? 'granted' : 'not-determined' }
    }

    async openSettings(): Promise<void> {
        if (!isMac) return shell.openExternal('ms-settings:notifications')
        const bundleId = this.bundleId()
        const query = bundleId ? `?id=${encodeURIComponent(bundleId)}` : ''
        await shell.openExternal(`x-apple.systempreferences:com.apple.Notifications-Settings.extension${query}`)
    }
}
