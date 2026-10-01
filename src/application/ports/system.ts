import type { MonitorStatus } from '@domain/monitor/monitor-status'
import type { AppNotification } from '@domain/notification/notification'
import type { NotifyPermissionInfo, NotifyProbeResult } from '@domain/notification/permission'
import type { ThemeMode } from '@domain/settings/appearance'
import type { UpdateStatus } from '@domain/update/release'
import type { Language } from '@domain/settings/settings'
import type { TimerState } from '@domain/time/timer'

export interface Clock {
    now(): Date
}

export interface IdGenerator {
    next(): string
}

export type Cancel = () => void

export interface Scheduler {
    after(ms: number, callback: () => void): Cancel
    every(ms: number, callback: () => void): Cancel
}

export interface SystemNotifier {
    show(items: AppNotification[]): void
    /** Sends a test notification and waits for the system's confirmation. */
    probe(): Promise<NotifyProbeResult>
}

export interface NotificationPermissionProbe {
    check(): Promise<NotifyPermissionInfo>
    openSettings(): Promise<void>
}

export interface AppEventsPublisher {
    notificationsChanged(items: AppNotification[]): void
    monitorStatusChanged(status: MonitorStatus): void
    permissionChanged(info: NotifyPermissionInfo): void
    updateStatusChanged(status: UpdateStatus): void
    timerChanged(timer: TimerState | null): void
}

/** Seconds since the last keyboard or mouse use, from the operating system. */
export interface IdleProbe {
    idleSeconds(): number
}

export interface LoginItem {
    setOpenAtLogin(enabled: boolean): void
}

export interface Localization {
    setLanguage(language: Language): void
}

/** Native theme: menus, title bar, scrollbars and the page's prefers-color-scheme follow it. */
export interface ThemeController {
    setThemeMode(mode: ThemeMode): void
}
