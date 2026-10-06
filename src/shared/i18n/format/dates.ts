import { addDays, daysBetween, daysSince, daysUntil, parseLocal, type LocalDate } from '@domain/shared/date'
import type { TFunction } from 'i18next'

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400
const MAX_DAYS_SHOWN_AS_RELATIVE = 30

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 1440
const MINUTES_PER_WEEK = 10080

const DAY_AND_MONTH: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }
const DAY_MONTH_AND_YEAR: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }

/** 2023-01-01 was a Sunday, so adding the weekday number (0 = Sunday) gives a date on that weekday. */
function dateOnWeekday(weekday: number): Date {
    return new Date(2023, 0, 1 + weekday)
}

export class DateFormatter {
    constructor(
        private readonly locale: string,
        private readonly t: TFunction
    ) {}

    /** 'YYYY-MM-DD' → 06/10 or 06/10/2026. */
    date(date?: string | null, withYear = false): string {
        if (!date) return '—'
        const localDate = parseLocal(date.slice(0, 10))
        const options = withYear ? DAY_MONTH_AND_YEAR : DAY_AND_MONTH
        return localDate.toLocaleDateString(this.locale, options)
    }

    dateTime(iso: string): string {
        return new Date(iso).toLocaleString(this.locale, {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    time(date: Date): string {
        return date.toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' })
    }

    weekdayShort(weekday: number): string {
        const label = dateOnWeekday(weekday).toLocaleDateString(this.locale, { weekday: 'short' })
        return label.replace('.', '')
    }

    weekdayLong(weekday: number): string {
        return dateOnWeekday(weekday).toLocaleDateString(this.locale, { weekday: 'long' })
    }

    monthDay(date: Date): string {
        return date.toLocaleDateString(this.locale, { day: 'numeric', month: 'long' })
    }

    /** Drops the abbreviation dots some locales add ("seg.", "set.") at the end of words. */
    format(date: Date, options: Intl.DateTimeFormatOptions): string {
        return date.toLocaleDateString(this.locale, options).replace(/\.(?=\s|$)/g, '')
    }

    /** "today", "tomorrow", "in 3 days", "2 days ago". */
    relativeDays(date: LocalDate, today: Date): string {
        const daysAhead = daysUntil(date, today)
        if (daysAhead === 0) return this.t('relative.today')
        if (daysAhead === 1) return this.t('relative.tomorrow')
        if (daysAhead === -1) return this.t('relative.yesterday')
        if (daysAhead > 0) return this.t('relative.inDays', { count: daysAhead })
        return this.t('relative.daysAgo', { count: -daysAhead })
    }

    /** "now", "5 min ago", "3 h ago", "2 d ago" or, after a month, the date. */
    relativeTime(iso: string, now: Date): string {
        const elapsedSeconds = (now.getTime() - new Date(iso).getTime()) / 1000
        if (elapsedSeconds < SECONDS_PER_MINUTE) return this.t('relative.now')
        if (elapsedSeconds < SECONDS_PER_HOUR) {
            const minutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE)
            return this.t('relative.minutesAgo', { count: minutes })
        }
        if (elapsedSeconds < SECONDS_PER_DAY) {
            const hours = Math.floor(elapsedSeconds / SECONDS_PER_HOUR)
            return this.t('relative.hoursAgo', { count: hours })
        }
        const days = daysSince(iso, now)
        if (days < MAX_DAYS_SHOWN_AS_RELATIVE) return this.t('relative.daysAgoShort', { count: days })
        return this.date(iso, true)
    }

    /** Time range of a calendar item: "14:00 – 15:00", "All day" or "Sep 27 – Sep 29". */
    range(start: Date, end: Date, allDay: boolean, allDayLabel: string): string {
        if (!allDay) return `${this.time(start)} – ${this.time(end)}`
        if (daysBetween(start, end) <= 1) return allDayLabel
        // The end of an all-day item is exclusive (midnight of the following day).
        const lastDay = addDays(end, -1)
        return `${this.shortDayMonth(start)} – ${this.shortDayMonth(lastDay)}`
    }

    hours(hours: number | null | undefined): string {
        if (hours == null) return '—'
        const rounded = Number(hours.toFixed(2))
        return this.t('duration.workHours', { value: rounded.toLocaleString(this.locale) })
    }

    /** Hours the way people type them in a field (1.5 → "1,5" in Portuguese); empty without a value. */
    hoursInput(hours: number | null | undefined): string {
        if (hours == null) return ''
        return hours.toLocaleString(this.locale, { maximumFractionDigits: 2, useGrouping: false })
    }

    private shortDayMonth(date: Date): string {
        const label = date.toLocaleDateString(this.locale, { day: '2-digit', month: 'short' })
        return label.replace('.', '')
    }
}

/** Human-readable duration: 5 min, 1 h, 1 h 30 min, 2 days, 1 week. */
export function humanizeMinutes(minutes: number, t: TFunction): string {
    if (minutes > 0 && minutes % MINUTES_PER_WEEK === 0) {
        return t('duration.weeks', { count: minutes / MINUTES_PER_WEEK })
    }
    if (minutes > 0 && minutes % MINUTES_PER_DAY === 0) {
        return t('duration.days', { count: minutes / MINUTES_PER_DAY })
    }
    if (minutes >= MINUTES_PER_HOUR && minutes % MINUTES_PER_HOUR === 0) {
        return t('duration.hours', { count: minutes / MINUTES_PER_HOUR })
    }
    if (minutes > MINUTES_PER_HOUR) {
        const hours = Math.floor(minutes / MINUTES_PER_HOUR)
        const remainingMinutes = minutes % MINUTES_PER_HOUR
        return t('duration.hoursMinutes', { hours, minutes: remainingMinutes })
    }
    return t('duration.minutes', { count: minutes })
}
