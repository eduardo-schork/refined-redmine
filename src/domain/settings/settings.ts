import type { ClaudeAction } from '../automation/claude-action'
import type { HandoffRule } from '../automation/handoff'
import type { Team } from '../time/team'
import { DEFAULT_WORK_SCHEDULE, type WorkSchedule } from '../time/business-hours'
import type { Board } from '../board/board'
import { DEFAULT_CALENDAR_PREFERENCES, type CalendarPreferences } from '../calendar/calendar-event'
import { createMineMonitor, defaultEvents, withMineMonitor, type MineScopes, type Monitor } from '../monitor/monitor'
import type { Schedule } from '../monitor/schedule'
import { DEFAULT_APPEARANCE, withAppearanceDefaults, type Appearance } from './appearance'
import type { RedmineUser } from '../redmine/entities'
import { DEFAULT_ISSUE_STYLE, withIssueStyleDefaults, type IssueStyleRules } from '../redmine/issue-style'
import { DEFAULT_SPRINT_CONVENTIONS, type SprintConventions } from '../sprint/sprint'

export type Language = 'system' | 'pt-BR' | 'en-US'
export const SUPPORTED_LANGUAGES: Exclude<Language, 'system'>[] = ['pt-BR', 'en-US']

/** User preferences. The API key is not stored here: it lives in the SecretStore. */
export interface Settings {
    baseUrl: string
    user?: RedmineUser
    language: Language
    appearance: Appearance
    pollSeconds: number
    schedule: Schedule
    /** The first one is always "my issues". */
    monitors: Monitor[]
    /** Also keep calendar reminders in the notification history (the system notification is always shown). */
    reminderHistory: boolean
    boards: Board[]
    /** The "Ágil" board was already created once (deleting it must not bring it back). */
    agileBoardSeeded: boolean
    sprints: SprintConventions
    dashboard: { staleDays: number }
    /** Status colors, priority levels and "due soon" window. */
    issueStyle: IssueStyleRules
    calendar: CalendarPreferences
    openAtLogin: boolean
    sound: boolean
    updates: UpdatePreferences
    workspace: WorkspacePreferences
    /** Teams for "Team time", made of project members. */
    teams: Team[]
    /** "Trâmite" buttons of the issue detail, in button order. */
    handoffRules: HandoffRule[]
    /** "Claude Code" buttons of the issue detail and of the cards' menu. */
    claudeActions: ClaudeAction[]
    /** Working hours: the time counted for a trâmite is split into normal hours and overtime with them. */
    workSchedule: WorkSchedule
    /** Status the issue goes to when the stopwatch starts on it ("In progress"); undefined = keep. */
    timerStartStatusId?: number
    /** Last version whose "What's new" was shown. */
    lastSeenVersion?: string
    /** Diagnostics: the activity log is hidden from the sidebar unless the user turns it on. */
    showLog: boolean
}

/** How screens open: in tabs (one per screen or board) or one at a time. */
export interface WorkspacePreferences {
    tabs: boolean
    /** Reopen the tabs of the last session when the app starts. */
    restoreTabs: boolean
}

export interface UpdatePreferences {
    autoCheck: boolean
    /** Hours between automatic update checks (one of UPDATE_CHECK_HOURS). */
    intervalHours: number
}

/** 1 h, 4 h, 12 h, 1 day, 1 week. GitHub allows 5,000 authenticated calls per hour, so even hourly is cheap. */
export const UPDATE_CHECK_HOURS = [1, 4, 12, 24, 168] as const

const DEFAULT_UPDATE_PREFERENCES: UpdatePreferences = { autoCheck: true, intervalHours: 24 }

/** An interval that is not one of the choices (hand-edited file) falls back to once a day. */
export function withUpdateDefaults(loaded: Partial<UpdatePreferences> = {}): UpdatePreferences {
    const allowed = (UPDATE_CHECK_HOURS as readonly number[]).includes(Number(loaded.intervalHours))
    return {
        autoCheck: loaded.autoCheck ?? DEFAULT_UPDATE_PREFERENCES.autoCheck,
        intervalHours: allowed ? Number(loaded.intervalHours) : DEFAULT_UPDATE_PREFERENCES.intervalHours
    }
}

export type SettingsPatch = Partial<Omit<Settings, 'user' | 'baseUrl'>>

export const MIN_POLL_SECONDS = 30

const DEFAULT_SCOPES: MineScopes = { assigned: true, watched: true, authored: true }

export const DEFAULT_SETTINGS: Settings = {
    baseUrl: '',
    language: 'pt-BR',
    appearance: DEFAULT_APPEARANCE,
    pollSeconds: 60,
    schedule: { enabled: false, weekdays: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 },
    monitors: [createMineMonitor(DEFAULT_SCOPES)],
    reminderHistory: true,
    boards: [],
    agileBoardSeeded: false,
    sprints: DEFAULT_SPRINT_CONVENTIONS,
    dashboard: { staleDays: 5 },
    issueStyle: DEFAULT_ISSUE_STYLE,
    calendar: DEFAULT_CALENDAR_PREFERENCES,
    openAtLogin: false,
    sound: true,
    updates: DEFAULT_UPDATE_PREFERENCES,
    workspace: { tabs: true, restoreTabs: true },
    teams: [],
    handoffRules: [],
    claudeActions: [],
    workSchedule: DEFAULT_WORK_SCHEDULE,
    showLog: false
}

type LegacyAlertOn = 'any' | 'increase' | 'decrease'
type LegacyKind =
    'new_issue' | 'assigned' | 'status' | 'comment' | 'mention' | 'updated' | 'unqueued' | 'query' | 'reminder'

/** Fields written by versions before monitors existed. */
export interface LegacySettings {
    scopes?: MineScopes
    eventKinds?: Partial<Record<LegacyKind, boolean>>
    customQueries?: {
        id: string
        name: string
        queryId: number
        projectId?: number
        alertOn: LegacyAlertOn
        enabled: boolean
    }[]
}

function legacyMineMonitor(legacy: LegacySettings): Monitor {
    const scopes = { ...DEFAULT_SCOPES, ...legacy.scopes }
    const kinds = legacy.eventKinds ?? {}
    const events = defaultEvents('mine')
    const journalKinds = ['new_issue', 'assigned', 'status', 'comment', 'mention', 'updated'] as const
    for (const kind of journalKinds) events[kind] = kinds[kind] ?? events[kind]
    events.left = kinds.unqueued ?? events.left
    return createMineMonitor(scopes, events)
}

// "Increase" alerted on new issues, "decrease" on issues leaving; journal events did not exist for queries.
function legacyQueryMonitor(query: NonNullable<LegacySettings['customQueries']>[number], queriesOn: boolean): Monitor {
    const events = { ...defaultEvents('query'), status: false, comment: false, mention: false }
    events.entered = query.alertOn !== 'decrease'
    events.left = query.alertOn !== 'increase'
    return {
        id: query.id,
        name: query.name,
        enabled: query.enabled && queriesOn,
        source: { type: 'query', queryId: query.queryId, projectId: query.projectId },
        events
    }
}

function upgradeMonitors(loaded: Partial<Settings> & LegacySettings): Monitor[] {
    if (loaded.monitors) return withMineMonitor(loaded.monitors, DEFAULT_SCOPES)
    const hasLegacyFields = Boolean(loaded.scopes || loaded.eventKinds || loaded.customQueries)
    if (!hasLegacyFields) return DEFAULT_SETTINGS.monitors
    const queriesOn = loaded.eventKinds?.query ?? true
    const queryMonitors = (loaded.customQueries ?? []).map((query) => legacyQueryMonitor(query, queriesOn))
    return [legacyMineMonitor(loaded), ...queryMonitors]
}

/** Fills old/partial settings with the defaults (deep merge on nested objects) and upgrades legacy fields. */
export function withDefaults(loaded: Partial<Settings> & LegacySettings): Settings {
    const { scopes: _scopes, eventKinds, customQueries: _queries, ...current } = loaded
    const defaults = DEFAULT_SETTINGS
    const calendarLayers = { ...defaults.calendar.layers, ...loaded.calendar?.layers }
    return {
        ...defaults,
        ...current,
        appearance: withAppearanceDefaults(loaded.appearance),
        monitors: upgradeMonitors(loaded),
        reminderHistory: loaded.reminderHistory ?? eventKinds?.reminder ?? defaults.reminderHistory,
        schedule: { ...defaults.schedule, ...loaded.schedule },
        sprints: { ...defaults.sprints, ...loaded.sprints },
        dashboard: { ...defaults.dashboard, ...loaded.dashboard },
        issueStyle: withIssueStyleDefaults(loaded.issueStyle),
        updates: withUpdateDefaults(loaded.updates),
        workspace: { ...defaults.workspace, ...loaded.workspace },
        workSchedule: { ...defaults.workSchedule, ...loaded.workSchedule },
        showLog: loaded.showLog === true,
        calendar: { ...defaults.calendar, ...loaded.calendar, layers: calendarLayers }
    }
}

/** Which changes require restarting the monitor. */
export function affectsMonitor(previous: Settings, patch: SettingsPatch): boolean {
    const pollChanged = patch.pollSeconds !== undefined && patch.pollSeconds !== previous.pollSeconds
    const monitoredSectionChanged = Boolean(patch.schedule || patch.monitors)
    return pollChanged || monitoredSectionChanged
}
