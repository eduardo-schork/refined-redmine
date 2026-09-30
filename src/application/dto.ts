import type { Board } from '@domain/board/board'
import type { LogEntry } from '@domain/log/log-entry'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import type { NotifyPermissionInfo } from '@domain/notification/permission'
import type { Monitor } from '@domain/monitor/monitor'
import type { CalendarEvent, EditScope } from '@domain/calendar/calendar-event'
import type { Issue, Page } from '@domain/redmine/entities'
import type { Settings } from '@domain/settings/settings'
import type { DetectedFields } from '@domain/sprint/sprint-classifier'
import type { Sprint } from '@domain/sprint/sprint'
import type { LocalDate } from '@domain/shared/date'

export type SettingsView = Settings & { hasApiKey: boolean }

export interface SprintList {
    configured: boolean
    all: Sprint[]
}

export interface BoardIssues {
    board: Board
    /** Resolved sprint (fixed or automatic), when the source is a sprint. */
    sprint?: Sprint
    /** Automatic sprint source with no matching version today. */
    unresolvedSprint: boolean
    sprintsConfigured: boolean
    issues: Page<Issue>
}

/** Notification options of a board. `null` switches its monitor off; undefined keeps it as it is. */
export type BoardNotifications = Pick<Monitor, 'enabled' | 'events'> | null

/** About the running app (Settings → General → About). */
export interface AppInfo {
    version: string
    electron: string
    platform: string
    arch: string
    dataPath: string
}

/** What "Copy support information" puts on the clipboard. Never includes the API key. */
export interface SupportReport {
    generatedAt: string
    app: AppInfo
    os: string
    language: string
    redmineHost: string
    userLogin?: string
    monitor: MonitorStatus
    permission: NotifyPermissionInfo
    monitors: { id: string; name: string; enabled: boolean; source: string }[]
    boardCount: number
    /** Latest warnings and errors from the activity log, newest first. */
    recentProblems: LogEntry[]
}

export interface ProjectInspection extends DetectedFields {
    versionCount: number
}

export interface SaveEventCommand {
    draft: CalendarEvent
    isNew: boolean
    originalId?: string
    occurrenceKey?: LocalDate
    scope: EditScope
}

export interface DeleteEventCommand {
    eventId: string
    occurrenceKey?: LocalDate
    scope: EditScope
}
