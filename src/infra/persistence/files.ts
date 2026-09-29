import type { CalendarEvent } from '@domain/calendar/calendar-event'
import type { QuerySnapshot } from '@domain/monitor/query-diff'
import type { AppNotification, NotificationKind } from '@domain/notification/notification'
import type { Settings } from '@domain/settings/settings'

// Kept compatible with the files written by previous versions of the app.

/** config.json: preferences + encrypted API key. */
export type ConfigFile = Partial<Settings> & {
    apiKeyEnc?: string
    apiKeyPlain?: string // only when the OS does not offer encryption
}

/** Notification stored before structured content existed (pre-rendered text). */
export interface LegacyNotification {
    id: string
    kind: NotificationKind
    title: string
    body: string
    issueId?: number
    url: string
    createdAt: string
    read: boolean
}

/** state.json: monitor state + notification history. */
export interface StateFile {
    lastCheckAt?: string
    notify?: { ok: boolean; at: string; error?: string }
    events: (AppNotification | LegacyNotification)[]
    querySnapshots: Record<string, QuerySnapshot>
}

/** calendar.json: events + reminders already fired. */
export interface CalendarFile {
    version: 1
    events: CalendarEvent[]
    fired: Record<string, string>
}
