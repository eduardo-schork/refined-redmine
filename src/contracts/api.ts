import type {
    AppInfo,
    BoardIssues,
    BoardNotifications,
    DeleteEventCommand,
    ProjectInspection,
    SaveEventCommand,
    SettingsView,
    SprintList
} from '@application/dto'
import type { Board } from '@domain/board/board'
import type { CalendarEvent } from '@domain/calendar/calendar-event'
import type { LogEntry } from '@domain/log/log-entry'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import type { AppNotification } from '@domain/notification/notification'
import type { NotifyPermissionInfo, NotifyProbeResult } from '@domain/notification/permission'
import type { Issue, IssueDetail, IssueStatus, Page, Project, SavedQuery } from '@domain/redmine/entities'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import type { SettingsPatch } from '@domain/settings/settings'
import type { SerializedError } from '@domain/shared/errors'
import type { VersionStats } from '@domain/sprint/sprint'

/** Each method becomes the IPC channel `<group>.<method>`; the UI never talks to Redmine directly. */
export interface RefinedApi {
    session: {
        get(): SettingsView
        login(baseUrl: string, apiKey: string): SettingsView
        logout(): SettingsView
    }
    settings: {
        update(patch: SettingsPatch): SettingsView
    }
    issues: {
        list(filter: IssueFilter, max?: number): Page<Issue>
        get(id: number): IssueDetail
        allowedStatuses(id: number): IssueStatus[]
        changeStatus(id: number, statusId: number): void
        comment(id: number, notes: string): void
    }
    reference: {
        statuses(): IssueStatus[]
        projects(): Project[]
        savedQueries(): SavedQuery[]
    }
    boards: {
        issues(boardId: string): BoardIssues
        /** `notifications`: the board's monitor (null switches it off; omitted keeps it as it is). */
        save(board: Board, notifications?: BoardNotifications): SettingsView
        remove(boardId: string): SettingsView
        move(boardId: string, issueId: number, columnId: string): IssueStatus
    }
    sprints: {
        list(): SprintList
        stats(versionId: number): VersionStats
        inspectProject(projectId: number): ProjectInspection
    }
    calendar: {
        list(): CalendarEvent[]
        save(command: SaveEventCommand): CalendarEvent[]
        remove(command: DeleteEventCommand): CalendarEvent[]
    }
    notifications: {
        list(): AppNotification[]
        markRead(ids: string[] | 'all'): AppNotification[]
        clear(): AppNotification[]
        test(): NotifyProbeResult
        permission(): NotifyPermissionInfo
        openSettings(): void
    }
    monitor: {
        status(): MonitorStatus
        runNow(): MonitorStatus
    }
    log: {
        list(): LogEntry[]
        clear(): void
    }
    app: {
        openExternal(url: string): void
        info(): AppInfo
        openDataFolder(): void
    }
}

/** Method list per group (used at runtime by the preload and the IPC router). */
export const API_METHODS = {
    session: ['get', 'login', 'logout'],
    settings: ['update'],
    issues: ['list', 'get', 'allowedStatuses', 'changeStatus', 'comment'],
    reference: ['statuses', 'projects', 'savedQueries'],
    boards: ['issues', 'save', 'remove', 'move'],
    sprints: ['list', 'stats', 'inspectProject'],
    calendar: ['list', 'save', 'remove'],
    notifications: ['list', 'markRead', 'clear', 'test', 'permission', 'openSettings'],
    monitor: ['status', 'runNow'],
    log: ['list', 'clear'],
    app: ['openExternal', 'info', 'openDataFolder']
} as const satisfies { [Group in keyof RefinedApi]: readonly (keyof RefinedApi[Group])[] }

/** Events from the main process to the UI. */
export interface AppEvents {
    'notifications.changed': AppNotification[]
    'monitor.status': MonitorStatus
    'permission.changed': NotifyPermissionInfo
    navigate: string
}

export const EVENT_CHANNELS = [
    'notifications.changed',
    'monitor.status',
    'permission.changed',
    'navigate'
] as const satisfies readonly (keyof AppEvents)[]

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: SerializedError }

type AnyFunction = (...args: never[]) => unknown

type BridgeMethod<Method> = Method extends AnyFunction
    ? (...args: Parameters<Method>) => Promise<IpcResult<Awaited<ReturnType<Method>>>>
    : never

/** What the preload exposes on `window.bridge`: each method returns Promise<IpcResult>. */
export type Bridge = {
    [Group in keyof RefinedApi]: {
        [Method in keyof RefinedApi[Group]]: BridgeMethod<RefinedApi[Group][Method]>
    }
} & {
    on<Event extends keyof AppEvents>(event: Event, listener: (payload: AppEvents[Event]) => void): () => void
}

export const channel = (group: string, method: string) => `${group}.${method}`

export type {
    AppInfo,
    BoardIssues,
    BoardNotifications,
    DeleteEventCommand,
    ProjectInspection,
    SaveEventCommand,
    SettingsView,
    SprintList
} from '@application/dto'
