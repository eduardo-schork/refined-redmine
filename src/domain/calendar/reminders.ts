import { addMinutes, startOfDay } from '../shared/date'
import type { CalendarEvent, CalendarPreferences } from './calendar-event'
import { occurrences, type Occurrence } from './recurrence'

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const SEARCH_MARGIN_MINUTES = 24 * 60

/** A reminder late by up to this limit still fires (e.g. app opened right after the time). */
export const REMINDER_GRACE_MS = 10 * MINUTE_MS
/** Marks of fired reminders are kept for 3 days. */
export const FIRED_TTL_MS = 3 * DAY_MS

export interface DueReminder {
    occurrence: Occurrence
    minutes: number
    /** Stable identity: one reminder per event/occurrence/lead time. */
    key: string
}

type ReminderPreferences = Pick<CalendarPreferences, 'allDayReminderHour'>

/** Reference moment: the event start or, for all-day, the default time on that day. */
export function reminderBase(occurrence: Occurrence, preferences: ReminderPreferences): Date {
    if (!occurrence.event.allDay) return occurrence.start
    const dayStart = startOfDay(occurrence.start).getTime()
    return new Date(dayStart + preferences.allDayReminderHour * HOUR_MS)
}

function isWithinGracePeriod(fireAt: number, now: Date): boolean {
    const lateByMs = now.getTime() - fireAt
    return lateByMs >= 0 && lateByMs <= REMINDER_GRACE_MS
}

function dueRemindersOf(
    event: CalendarEvent,
    now: Date,
    preferences: ReminderPreferences,
    alreadyFired: (key: string) => boolean
): DueReminder[] {
    if (!event.reminders?.length) return []
    const graceMinutes = REMINDER_GRACE_MS / MINUTE_MS
    const from = addMinutes(now, -graceMinutes - SEARCH_MARGIN_MINUTES)
    const to = addMinutes(now, Math.max(...event.reminders) + SEARCH_MARGIN_MINUTES)
    const due: DueReminder[] = []
    for (const occurrence of occurrences(event, from, to)) {
        const base = reminderBase(occurrence, preferences).getTime()
        for (const minutes of event.reminders) {
            const fireAt = base - minutes * MINUTE_MS
            const key = `${event.id}|${occurrence.key}|${minutes}`
            if (isWithinGracePeriod(fireAt, now) && !alreadyFired(key)) due.push({ occurrence, minutes, key })
        }
    }
    return due
}

/** Reminders that should fire now and have not fired yet. */
export function findDueReminders(
    events: CalendarEvent[],
    now: Date,
    preferences: ReminderPreferences,
    alreadyFired: (key: string) => boolean
): DueReminder[] {
    return events.flatMap((event) => dueRemindersOf(event, now, preferences, alreadyFired))
}
