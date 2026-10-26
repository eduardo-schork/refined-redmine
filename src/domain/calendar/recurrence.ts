import { addDays, addMinutes, daysBetween, daysInMonth, parseLocal, toLocalDate, type LocalDate } from '../shared/date'
import type { CalendarEvent, Recurrence } from './calendar-event'

const DAY_MS = 86_400_000
const MAX_ITERATIONS = 20_000
const FALLBACK_DURATION_MINUTES = 30

export interface Occurrence {
    event: CalendarEvent
    start: Date
    /** Exclusive; all-day ends at 00:00 of the next day. */
    end: Date
    /** Original date of the occurrence (exceptions and "edit this only"). */
    key: LocalDate
}

/** Position of the weekday in the month: 1..4 (5 = fifth occurrence) and whether it is the last. */
export function nthWeekdayOf(date: Date): { nth: number; isLast: boolean } {
    const dayOfMonth = date.getDate()
    const monthLength = daysInMonth(date.getFullYear(), date.getMonth())
    return { nth: Math.ceil(dayOfMonth / 7), isLast: dayOfMonth + 7 > monthLength }
}

export function eventBounds(event: Pick<CalendarEvent, 'allDay' | 'start' | 'end'>): { start: Date; end: Date } {
    if (event.allDay) {
        const start = parseLocal(event.start.slice(0, 10))
        const endDay = parseLocal(event.end.slice(0, 10))
        const lastDay = endDay < start ? start : endDay
        return { start, end: addDays(lastDay, 1) }
    }
    const start = parseLocal(event.start)
    const end = parseLocal(event.end)
    const validEnd = end > start ? end : addMinutes(start, FALLBACK_DURATION_MINUTES)
    return { start, end: validEnd }
}

/** Whole periods that can be jumped over to get near `skipTo`, keeping one period of margin. */
function periodsToSkip(from: Date, periodDays: number, skipTo: Date | undefined): number {
    if (!skipTo) return 0
    const wholePeriods = Math.floor(daysBetween(from, skipTo) / periodDays)
    return Math.max(0, wholePeriods - 1)
}

function* dailyCandidates(start: Date, interval: number, skipTo: Date | undefined): Generator<Date> {
    for (let period = periodsToSkip(start, interval, skipTo); ; period++) {
        yield addDays(start, period * interval)
    }
}

function* weeklyCandidates(
    start: Date,
    interval: number,
    byWeekday: number[] | undefined,
    skipTo: Date | undefined
): Generator<Date> {
    const weekdays = byWeekday?.length ? [...byWeekday] : [start.getDay()]
    weekdays.sort((first, second) => first - second)
    const firstWeekStart = addDays(start, -start.getDay())
    const periodDays = 7 * interval
    for (let period = periodsToSkip(firstWeekStart, periodDays, skipTo); ; period++) {
        const weekStart = addDays(firstWeekStart, period * periodDays)
        for (const weekday of weekdays) {
            const candidate = addDays(weekStart, weekday)
            if (candidate >= start) yield candidate
        }
    }
}

/** Day of the month of its `nth` `weekday` (-1 = the last one), or null when the month does not have it. */
function nthWeekdayDay(year: number, month: number, weekday: number, nth: number): number | null {
    const lastDay = daysInMonth(year, month)
    if (nth === -1) {
        const lastDayWeekday = new Date(year, month, lastDay).getDay()
        return lastDay - ((lastDayWeekday - weekday + 7) % 7)
    }
    const firstDayWeekday = new Date(year, month, 1).getDay()
    const firstMatchingDay = 1 + ((weekday - firstDayWeekday + 7) % 7)
    const day = firstMatchingDay + (nth - 1) * 7
    return day > lastDay ? null : day
}

/** Last Monday–Friday of the month (holidays are not known). */
export function lastWorkdayOfMonth(year: number, month: number): number {
    const lastDay = daysInMonth(year, month)
    const weekday = new Date(year, month, lastDay).getDay()
    if (weekday === 0) return lastDay - 2
    if (weekday === 6) return lastDay - 1
    return lastDay
}

/** Day of the occurrence in the given month, or null when the month has no occurrence. */
function monthlyDay(recurrence: Recurrence, start: Date, year: number, month: number): number | null {
    if (recurrence.monthlyMode === 'lastWorkday') return lastWorkdayOfMonth(year, month)
    if (recurrence.monthlyMode === 'weekday') {
        const nth = recurrence.monthlyNth ?? nthWeekdayOf(start).nth
        return nthWeekdayDay(year, month, start.getDay(), nth)
    }
    const day = start.getDate()
    // e.g. the 31st in 30-day months
    if (day > daysInMonth(year, month)) return null
    return day
}

function* monthlyCandidates(start: Date, recurrence: Recurrence, interval: number): Generator<Date> {
    for (let monthOffset = 0; ; monthOffset += interval) {
        const monthsFromYearStart = start.getMonth() + monthOffset
        const year = start.getFullYear() + Math.floor(monthsFromYearStart / 12)
        const month = monthsFromYearStart % 12
        const day = monthlyDay(recurrence, start, year, month)
        if (day === null) continue
        const candidate = new Date(year, month, day, start.getHours(), start.getMinutes())
        if (candidate >= start) yield candidate
    }
}

function* yearlyCandidates(start: Date, interval: number): Generator<Date> {
    for (let yearOffset = 0; ; yearOffset += interval) {
        const year = start.getFullYear() + yearOffset
        // Feb 29
        if (start.getDate() > daysInMonth(year, start.getMonth())) continue
        yield new Date(year, start.getMonth(), start.getDate(), start.getHours(), start.getMinutes())
    }
}

/** Start candidates in chronological order, from the start of the series. */
function candidates(start: Date, recurrence: Recurrence, skipTo?: Date): Generator<Date> {
    const interval = Math.max(1, recurrence.interval || 1)
    // With a count, every occurrence since the series start must be counted, so nothing is skipped.
    const canSkip = !recurrence.count && skipTo !== undefined && skipTo > start
    const skipTarget = canSkip ? skipTo : undefined
    switch (recurrence.freq) {
        case 'daily':
            return dailyCandidates(start, interval, skipTarget)
        case 'weekly':
            return weeklyCandidates(start, interval, recurrence.byWeekday, skipTarget)
        case 'monthly':
            return monthlyCandidates(start, recurrence, interval)
        case 'yearly':
            return yearlyCandidates(start, interval)
    }
}

function seriesHasEnded(recurrence: Recurrence, until: Date | null, candidate: Date, countSoFar: number): boolean {
    if (until && candidate >= until) return true
    if (!recurrence.count) return false
    return countSoFar >= recurrence.count
}

function recurringOccurrences(event: CalendarEvent, recurrence: Recurrence, from: Date, to: Date): Occurrence[] {
    const { start, end } = eventBounds(event)
    const durationDays = daysBetween(start, end)
    const durationMs = end.getTime() - start.getTime()
    const endOf = (occurrenceStart: Date) =>
        event.allDay ? addDays(occurrenceStart, durationDays) : new Date(occurrenceStart.getTime() + durationMs)

    const until = recurrence.until ? addDays(parseLocal(recurrence.until), 1) : null
    const exceptions = new Set(event.exceptions ?? [])
    const skipTo = new Date(from.getTime() - durationMs - DAY_MS)
    const result: Occurrence[] = []
    let countSoFar = 0
    let iterations = 0
    for (const occurrenceStart of candidates(start, recurrence, skipTo)) {
        iterations++
        if (iterations > MAX_ITERATIONS) break
        if (seriesHasEnded(recurrence, until, occurrenceStart, countSoFar)) break
        // Removed occurrences still count toward `count`.
        countSoFar++
        if (occurrenceStart >= to) break
        const key = toLocalDate(occurrenceStart)
        if (exceptions.has(key)) continue
        const occurrenceEnd = endOf(occurrenceStart)
        if (occurrenceEnd > from) result.push({ event, start: occurrenceStart, end: occurrenceEnd, key })
    }
    return result
}

/** Occurrences of the event that overlap the range [from, to). */
export function occurrences(event: CalendarEvent, from: Date, to: Date): Occurrence[] {
    if (event.recurrence) return recurringOccurrences(event, event.recurrence, from, to)
    const { start, end } = eventBounds(event)
    const overlapsRange = end > from && start < to
    if (!overlapsRange) return []
    return [{ event, start, end, key: toLocalDate(start) }]
}

function compareOccurrences(first: Occurrence, second: Occurrence): number {
    const byStart = first.start.getTime() - second.start.getTime()
    if (byStart) return byStart
    return Number(second.event.allDay) - Number(first.event.allDay)
}

/** All occurrences in the range, by start (all-day first at the same instant). */
export function expand(events: CalendarEvent[], from: Date, to: Date): Occurrence[] {
    return events.flatMap((event) => occurrences(event, from, to)).sort(compareOccurrences)
}
