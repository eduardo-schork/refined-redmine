import {
    addDays,
    addMinutes,
    daysBetween,
    parseLocal,
    toLocalDate,
    toLocalDateTime,
    type LocalDate
} from '../shared/date'
import { DEFAULT_EVENT_COLOR } from './colors'
import type { CalendarChange, CalendarEvent, CalendarPreferences, EditScope, Recurrence } from './calendar-event'
import { eventBounds, expand, type Occurrence } from './recurrence'

/** Ids and timestamps are injected so that edits are deterministic. */
export interface EditContext {
    newId: () => string
    nowIso: string
}

interface EventDates {
    start: string
    end: string
}

function newEventDates(
    preferences: CalendarPreferences,
    start: Date,
    end: Date | undefined,
    allDay: boolean
): EventDates {
    if (allDay) {
        // The selected end is exclusive; all-day events store an inclusive end date.
        const lastDay = end ? addDays(end, -1) : start
        return { start: toLocalDate(start), end: toLocalDate(lastDay) }
    }
    const timedEnd = end ?? addMinutes(start, preferences.defaultDuration)
    return { start: toLocalDateTime(start), end: toLocalDateTime(timedEnd) }
}

/** A new appointment with the user's defaults. */
export function createEvent(
    preferences: CalendarPreferences,
    context: EditContext,
    start: Date,
    end?: Date,
    allDay = false
): CalendarEvent {
    const dates = newEventDates(preferences, start, end, allDay)
    const reminders = allDay ? preferences.defaultAllDayReminders : preferences.defaultReminders
    return {
        id: context.newId(),
        title: '',
        color: DEFAULT_EVENT_COLOR,
        allDay,
        start: dates.start,
        end: dates.end,
        reminders: [...reminders],
        createdAt: context.nowIso,
        updatedAt: context.nowIso
    }
}

/** Standalone (non-recurring) copy of an occurrence. */
export function duplicateOccurrence(event: CalendarEvent, occurrence: Occurrence, context: EditContext): CalendarEvent {
    return {
        ...atOccurrence(event, occurrence),
        id: context.newId(),
        recurrence: undefined,
        exceptions: undefined,
        createdAt: context.nowIso,
        updatedAt: context.nowIso
    }
}

/** The event as it would be at a specific occurrence (to open the editor on that date). */
export function atOccurrence(event: CalendarEvent, occurrence: Occurrence): CalendarEvent {
    if (!event.recurrence) return event
    if (event.allDay) {
        const lastDay = addDays(occurrence.end, -1)
        return { ...event, start: toLocalDate(occurrence.start), end: toLocalDate(lastDay) }
    }
    return { ...event, start: toLocalDateTime(occurrence.start), end: toLocalDateTime(occurrence.end) }
}

/** How many occurrences of the series happen before `key` (to split series with "count"). */
function countBefore(event: CalendarEvent, key: LocalDate): number {
    const withoutExceptions = { ...event, exceptions: [] }
    const seriesStart = eventBounds(event).start
    return expand([withoutExceptions], seriesStart, parseLocal(key)).length
}

function recurrenceEndingBefore(original: CalendarEvent, key: LocalDate): Recurrence {
    const recurrence = original.recurrence!
    if (recurrence.count) return { ...recurrence, count: countBefore(original, key), until: undefined }
    const dayBefore = addDays(parseLocal(key), -1)
    return { ...recurrence, until: toLocalDate(dayBefore) }
}

function endSeriesBefore(original: CalendarEvent, key: LocalDate, nowIso: string): CalendarEvent {
    return { ...original, recurrence: recurrenceEndingBefore(original, key), updatedAt: nowIso }
}

function withException(event: CalendarEvent, occurrenceKey: LocalDate, nowIso: string): CalendarEvent {
    const exceptions = [...(event.exceptions ?? []), occurrenceKey]
    return { ...event, exceptions, updatedAt: nowIso }
}

function saveThisOccurrence(
    original: CalendarEvent,
    edited: CalendarEvent,
    occurrenceKey: LocalDate,
    context: EditContext
): CalendarChange {
    const standalone: CalendarEvent = {
        ...edited,
        id: context.newId(),
        recurrence: undefined,
        exceptions: undefined,
        createdAt: context.nowIso
    }
    const seriesWithException = withException(original, occurrenceKey, context.nowIso)
    return { upsert: [seriesWithException, standalone] }
}

/** If the count was not edited, the new series keeps only the occurrences the original series had left. */
function tailRecurrence(
    original: CalendarEvent,
    edited: CalendarEvent,
    occurrenceKey: LocalDate
): Recurrence | undefined {
    const originalCount = original.recurrence?.count
    const editedRecurrence = edited.recurrence
    if (!editedRecurrence || !originalCount || editedRecurrence.count !== originalCount) return editedRecurrence
    const occurrencesBefore = countBefore(original, occurrenceKey)
    return { ...editedRecurrence, count: Math.max(1, originalCount - occurrencesBefore) }
}

function saveFollowingOccurrences(
    original: CalendarEvent,
    edited: CalendarEvent,
    occurrenceKey: LocalDate,
    context: EditContext
): CalendarChange {
    const followingExceptions = (original.exceptions ?? []).filter((exception) => exception > occurrenceKey)
    const tail: CalendarEvent = {
        ...edited,
        id: context.newId(),
        recurrence: tailRecurrence(original, edited, occurrenceKey),
        exceptions: followingExceptions,
        createdAt: context.nowIso
    }
    const head = endSeriesBefore(original, occurrenceKey, context.nowIso)
    return { upsert: [head, tail] }
}

/** Start and end of the whole series, keeping the edited duration, when its first day moves to `seriesStart`. */
function seriesDatesFrom(edited: CalendarEvent, seriesStart: Date): EventDates {
    const { start: editedStart, end: editedEnd } = eventBounds(edited)
    if (edited.allDay) {
        const extraDays = daysBetween(editedStart, editedEnd) - 1
        const lastDay = addDays(seriesStart, extraDays)
        return { start: toLocalDate(seriesStart), end: toLocalDate(lastDay) }
    }
    const durationMs = editedEnd.getTime() - editedStart.getTime()
    const startTime = edited.start.slice(10)
    const start = `${toLocalDate(seriesStart)}${startTime}`
    const end = toLocalDateTime(new Date(parseLocal(start).getTime() + durationMs))
    return { start, end }
}

function shiftExceptions(exceptions: LocalDate[], days: number): LocalDate[] {
    return exceptions.map((exception) => toLocalDate(addDays(parseLocal(exception), days)))
}

function saveWholeSeries(original: CalendarEvent, edited: CalendarEvent, occurrenceKey: LocalDate): CalendarChange {
    const editedDay = parseLocal(edited.start.slice(0, 10))
    const shiftDays = daysBetween(parseLocal(occurrenceKey), editedDay)
    const originalSeriesStart = parseLocal(original.start.slice(0, 10))
    const seriesStart = addDays(originalSeriesStart, shiftDays)
    const { start, end } = seriesDatesFrom(edited, seriesStart)
    const exceptions = shiftDays ? shiftExceptions(original.exceptions ?? [], shiftDays) : original.exceptions
    const series: CalendarEvent = {
        ...edited,
        id: original.id,
        start,
        end,
        exceptions,
        createdAt: original.createdAt
    }
    return { upsert: [series] }
}

/**
 * Saves the edit of an occurrence according to the scope (Google Calendar):
 * - this: exception in the series + standalone event
 * - following: ends the series before the occurrence + new series starting from it
 * - all: applies to the whole series, shifting it by the date difference
 * `draft` already comes with the dates of the edited occurrence.
 */
export function planSave(
    original: CalendarEvent | undefined,
    draft: CalendarEvent,
    occurrenceKey: LocalDate | undefined,
    scope: EditScope,
    context: EditContext
): CalendarChange {
    const edited = { ...draft, updatedAt: context.nowIso }
    if (!original || !original.recurrence || !occurrenceKey) return { upsert: [edited] }

    // "This and following" from the first occurrence is the same as editing the whole series.
    const isSeriesStart = occurrenceKey === original.start.slice(0, 10)
    const effectiveScope: EditScope = scope === 'following' && isSeriesStart ? 'all' : scope

    switch (effectiveScope) {
        case 'this':
            return saveThisOccurrence(original, edited, occurrenceKey, context)
        case 'following':
            return saveFollowingOccurrences(original, edited, occurrenceKey, context)
        case 'all':
            return saveWholeSeries(original, edited, occurrenceKey)
    }
}

export function planDelete(
    original: CalendarEvent,
    occurrenceKey: LocalDate | undefined,
    scope: EditScope,
    nowIso: string
): CalendarChange {
    if (!original.recurrence || !occurrenceKey) return { remove: [original.id] }

    const isSeriesStart = occurrenceKey === original.start.slice(0, 10)
    const deletesWholeSeries = scope === 'all' || (scope === 'following' && isSeriesStart)
    if (deletesWholeSeries) return { remove: [original.id] }

    if (scope === 'this') return { upsert: [withException(original, occurrenceKey, nowIso)] }
    return { upsert: [endSeriesBefore(original, occurrenceKey, nowIso)] }
}

export function applyChange(events: CalendarEvent[], change: CalendarChange): CalendarEvent[] {
    const removedIds = new Set(change.remove ?? [])
    const keptEvents = events.filter((event) => !removedIds.has(event.id))
    const eventsById = new Map(keptEvents.map((event) => [event.id, event]))
    for (const upserted of change.upsert ?? []) eventsById.set(upserted.id, upserted)
    return [...eventsById.values()]
}
