import { app, Menu, nativeImage, Tray, type NativeImage } from 'electron'
import { join } from 'node:path'
import { elapsedMs, formatClock, isRunning, type TimerState } from '@domain/time/timer'
import type { MainLocalization } from '@infra/electron/main-localization'
import { resourcesPath } from './window'

const isMac = process.platform === 'darwin'

export interface TrayActions {
    open(route?: string): void
    checkNow(): void
    pauseTimer(): void
    resumeTimer(): void
    quit(): void
}

/** The stopwatch in the menu bar changes once a minute; refreshing twice a minute keeps it on time. */
const TIMER_REFRESH_MS = 30_000

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
    private timer: TimerState | null = null
    private timerRefresh: ReturnType<typeof setInterval> | null = null

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

    setTimer(timer: TimerState | null): void {
        this.timer = timer
        if (this.timerRefresh) clearInterval(this.timerRefresh)
        this.timerRefresh = timer && isRunning(timer) ? setInterval(() => this.render(), TIMER_REFRESH_MS) : null
        this.render()
    }

    /** "⏱ 1:42" while running, "⏸ 1:42" while paused; empty without a stopwatch. */
    private timerText(): string {
        if (!this.timer) return ''
        const symbol = isRunning(this.timer) ? '⏱' : '⏸'
        return `${symbol} ${formatClock(elapsedMs(this.timer, new Date()))}`
    }

    private timerMenu(): Electron.MenuItemConstructorOptions[] {
        const timer = this.timer
        if (!timer) return []
        const { t } = this.localization
        const label = t('tray.timer', { clock: this.timerText(), id: timer.issueId })
        const toggle = isRunning(timer)
            ? { label: t('tray.pauseTimer'), click: () => this.actions.pauseTimer() }
            : { label: t('tray.resumeTimer'), click: () => this.actions.resumeTimer() }
        return [{ label, click: () => this.actions.open('/time') }, toggle, { type: 'separator' }]
    }

    render(): void {
        const { t } = this.localization
        const unreadCount = this.unread
        app.setBadgeCount(unreadCount)
        if (!this.tray) return

        const timerText = this.timerText()
        const unreadText = unreadCount ? String(unreadCount) : ''
        if (isMac) this.tray.setTitle([timerText, unreadText].filter(Boolean).join(' · '))
        const unreadTooltip = unreadCount ? t('tray.tooltipUnread', { count: unreadCount }) : t('app.name')
        const tooltip = timerText ? `${unreadTooltip} — ${timerText}` : unreadTooltip
        this.tray.setToolTip(tooltip)
        const notificationsLabel = unreadCount
            ? t('tray.notificationsUnread', { count: unreadCount })
            : t('tray.notifications')
        this.tray.setContextMenu(
            Menu.buildFromTemplate([
                ...this.timerMenu(),
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
