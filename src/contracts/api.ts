import type {
    AppInfo,
    BoardIssues,
    BoardNotifications,
    DeleteEventCommand,
    IssueEditOptions,
    IssueEditResult,
    MyTimeEntries,
    ProjectInspection,
    SaveEventCommand,
    SettingsView,
    SprintList,
    SupportReport
} from '@application/dto'
import type { Board } from '@domain/board/board'
import type { CalendarEvent } from '@domain/calendar/calendar-event'
import type { LogEntry } from '@domain/log/log-entry'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import type { AppNotification } from '@domain/notification/notification'
import type { NotifyPermissionInfo, NotifyProbeResult } from '@domain/notification/permission'
import type {
    Issue,
    IssueDetail,
    IssuePriority,
    IssueStatus,
    Page,
    Project,
    SavedQuery
} from '@domain/redmine/entities'
import type { IssueFieldsChange } from '@domain/redmine/issue-edit'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import type { SettingsPatch } from '@domain/settings/settings'
import type { SerializedError } from '@domain/shared/errors'
import type { LocalDate } from '@domain/shared/date'
import type { TimeEntry, TimeEntryActivity, TimeEntryDraft } from '@domain/time/time-entry'
import type { StoppedTimer, TimerState } from '@domain/time/timer'
import type { UpdateStatus } from '@domain/update/release'
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
        /** Quick search: "#1234" or "1234" finds that issue; text searches the titles. */
        search(input: string): Issue[]
        edit(id: number, change: IssueFieldsChange): IssueEditResult
        editOptions(projectId: number): IssueEditOptions
    }
    reference: {
        statuses(): IssueStatus[]
        projects(): Project[]
        savedQueries(): SavedQuery[]
        priorities(): IssuePriority[]
        timeActivities(): TimeEntryActivity[]
    }
    time: {
        forIssue(issueId: number): TimeEntry[]
        /** The signed-in user's entries between two dates (inclusive), with their issues. */
        mine(from: LocalDate, to: LocalDate): MyTimeEntries
        log(draft: TimeEntryDraft): TimeEntry
        edit(id: number, draft: TimeEntryDraft): void
        remove(id: number): void
        /** Logs the previous week's entries again one week later; returns how many were created. */
        repeatWeek(previousWeekStart: LocalDate, previousWeekEnd: LocalDate): number
    }
    timer: {
        status(): TimerState | null
        start(issue: { id: number; subject: string }): TimerState
        pause(): TimerState | null
        resume(): TimerState | null
        /** Pauses and returns the counted hours to log; the stopwatch stays paused until logged or discarded. */
        stop(): StoppedTimer | null
        discard(): null
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
        /** The user's answer to "did the test notification appear?". */
        confirm(seen: boolean): NotifyPermissionInfo
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
    updates: {
        status(): UpdateStatus
        check(): UpdateStatus
        /** null removes the token. */
        setToken(token: string | null): UpdateStatus
        testToken(token: string): { latestVersion?: string }
        download(): UpdateStatus
        install(): void
    }
    app: {
        openExternal(url: string): void
        info(): AppInfo
        openDataFolder(): void
        supportReport(): SupportReport
    }
}

/** Method list per group (used at runtime by the preload and the IPC router). */
export const API_METHODS = {
    session: ['get', 'login', 'logout'],
    settings: ['update'],
    issues: ['list', 'get', 'allowedStatuses', 'changeStatus', 'comment', 'search', 'edit', 'editOptions'],
    reference: ['statuses', 'projects', 'savedQueries', 'priorities', 'timeActivities'],
    time: ['forIssue', 'mine', 'log', 'edit', 'remove', 'repeatWeek'],
    timer: ['status', 'start', 'pause', 'resume', 'stop', 'discard'],
    boards: ['issues', 'save', 'remove', 'move'],
    sprints: ['list', 'stats', 'inspectProject'],
    calendar: ['list', 'save', 'remove'],
    notifications: ['list', 'markRead', 'clear', 'test', 'confirm', 'permission', 'openSettings'],
    monitor: ['status', 'runNow'],
    log: ['list', 'clear'],
    updates: ['status', 'check', 'setToken', 'testToken', 'download', 'install'],
    app: ['openExternal', 'info', 'openDataFolder', 'supportReport']
} as const satisfies { [Group in keyof RefinedApi]: readonly (keyof RefinedApi[Group])[] }

/** Events from the main process to the UI. */
export interface AppEvents {
    'notifications.changed': AppNotification[]
    'monitor.status': MonitorStatus
    'permission.changed': NotifyPermissionInfo
    'update.status': UpdateStatus
    'timer.status': TimerState | null
    navigate: string
}

export const EVENT_CHANNELS = [
    'notifications.changed',
    'monitor.status',
    'permission.changed',
    'update.status',
    'timer.status',
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
    IssueEditOptions,
    IssueEditResult,
    ProjectInspection,
    SaveEventCommand,
    SettingsView,
    SprintList,
    SupportReport
} from '@application/dto'
