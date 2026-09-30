import type { Board } from '../board/board'
import { DEFAULT_CALENDAR_PREFERENCES, type CalendarPreferences } from '../calendar/calendar-event'
import { createMineMonitor, defaultEvents, withMineMonitor, type MineScopes, type Monitor } from '../monitor/monitor'
import type { Schedule } from '../monitor/schedule'
import { DEFAULT_APPEARANCE, withAppearanceDefaults, type Appearance } from './appearance'
import type { RedmineUser } from '../redmine/entities'
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
    sprints: SprintConventions
    dashboard: { staleDays: number }
    calendar: CalendarPreferences
    openAtLogin: boolean
    sound: boolean
    updates: { autoCheck: boolean }
    /** Last version whose "What's new" was shown. */
    lastSeenVersion?: string
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
    sprints: DEFAULT_SPRINT_CONVENTIONS,
    dashboard: { staleDays: 5 },
    calendar: DEFAULT_CALENDAR_PREFERENCES,
    openAtLogin: false,
    sound: true,
    updates: { autoCheck: true }
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
        updates: { ...defaults.updates, ...loaded.updates },
        calendar: { ...defaults.calendar, ...loaded.calendar, layers: calendarLayers }
    }
}

/** Which changes require restarting the monitor. */
export function affectsMonitor(previous: Settings, patch: SettingsPatch): boolean {
    const pollChanged = patch.pollSeconds !== undefined && patch.pollSeconds !== previous.pollSeconds
    const monitoredSectionChanged = Boolean(patch.schedule || patch.monitors)
    return pollChanged || monitoredSectionChanged
}
