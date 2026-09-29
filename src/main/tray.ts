import { app, Menu, nativeImage, Tray, type NativeImage } from 'electron'
import { join } from 'node:path'
import type { MainLocalization } from '@infra/electron/main-localization'
import { resourcesPath } from './window'

const isMac = process.platform === 'darwin'

export interface TrayActions {
    open(route?: string): void
    checkNow(): void
    quit(): void
}

/** On macOS a template image adapts to the light/dark menu bar. */
function createTrayIcon(): NativeImage {
    if (!isMac) {
        const icon = nativeImage.createFromPath(join(resourcesPath(), 'icon.png'))
        return icon.resize({ width: 16, height: 16 })
    }
    const icon = nativeImage.createFromPath(join(resourcesPath(), 'trayTemplate.png'))
    icon.setTemplateImage(true)
    return icon
}

/** Tray icon, menu and unread counter (also on the Dock). */
export class TrayController {
    private tray: Tray | null = null
    private unread = 0

    constructor(
        private readonly localization: MainLocalization,
        private readonly actions: TrayActions
    ) {}

    create(): void {
        this.tray = new Tray(createTrayIcon())
        this.tray.on('click', () => this.actions.open())
        this.render()
    }

    setUnread(count: number): void {
        this.unread = count
        this.render()
    }

    render(): void {
        const { t } = this.localization
        const unreadCount = this.unread
        app.setBadgeCount(unreadCount)
        if (!this.tray) return

        if (isMac) this.tray.setTitle(unreadCount ? String(unreadCount) : '')
        const tooltip = unreadCount ? t('tray.tooltipUnread', { count: unreadCount }) : t('app.name')
        this.tray.setToolTip(tooltip)
        const notificationsLabel = unreadCount
            ? t('tray.notificationsUnread', { count: unreadCount })
            : t('tray.notifications')
        this.tray.setContextMenu(
            Menu.buildFromTemplate([
                { label: t('tray.open'), click: () => this.actions.open() },
                { label: t('tray.calendar'), click: () => this.actions.open('/calendar') },
                { label: notificationsLabel, click: () => this.actions.open('/notifications') },
                { label: t('tray.checkNow'), click: () => this.actions.checkNow() },
                { type: 'separator' },
                { label: t('tray.quit'), click: () => this.actions.quit() }
            ])
        )
    }
}
