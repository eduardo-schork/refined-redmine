import type { LocalDate, LocalDateTime } from '../shared/date'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Recurrence rule: a subset of RRULE, as in Google Calendar. */
export interface Recurrence {
    freq: RecurrenceFreq
    interval: number
    byWeekday?: number[] // weekly: 0 = Sunday … 6 = Saturday
    monthlyMode?: 'day' | 'weekday' | 'lastWorkday' // monthly: on day N | on the Nth <weekday> | last Mon–Fri
    monthlyNth?: number // 1..4 or -1 (last)
    until?: LocalDate // inclusive
    count?: number
}

export type EventColor =
    | 'tomato'
    | 'flamingo'
    | 'tangerine'
    | 'banana'
    | 'sage'
    | 'basil'
    | 'peacock'
    | 'blueberry'
    | 'lavender'
    | 'grape'
    | 'graphite'

/** An appointment (or a recurring series) in the local calendar. */
export interface CalendarEvent {
    id: string
    title: string
    description?: string
    location?: string
    color: EventColor
    allDay: boolean
    start: LocalDateTime | LocalDate // all-day: date only
    end: LocalDateTime | LocalDate // all-day: inclusive end date
    recurrence?: Recurrence
    exceptions?: LocalDate[] // removed occurrences ("this only")
    reminders: number[] // minutes before (all-day: from the day's default time)
    issueId?: number
    createdAt: string
    updatedAt: string
}

export interface CalendarChange {
    upsert?: CalendarEvent[]
    remove?: string[]
}

export type EditScope = 'this' | 'following' | 'all'

export type CalendarView = 'month' | 'week' | 'day' | 'agenda'

export interface CalendarPreferences {
    defaultView: CalendarView
    weekStartsOn: 0 | 1
    defaultReminders: number[]
    defaultAllDayReminders: number[]
    allDayReminderHour: number
    defaultDuration: number
    layers: { mine: boolean; sprints: boolean; tasks: boolean }
}

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
    defaultView: 'week',
    weekStartsOn: 0,
    defaultReminders: [10],
    defaultAllDayReminders: [],
    allDayReminderHour: 9,
    defaultDuration: 60,
    layers: { mine: true, sprints: true, tasks: true }
}

export const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]
export const ALLDAY_REMINDER_PRESETS = [0, 1440, 2880, 10080]
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120]
