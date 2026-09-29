import type { Recurrence } from '@domain/calendar/calendar-event'
import { nthWeekdayOf } from '@domain/calendar/recurrence'
import type { TFunction } from 'i18next'
import type { DateFormatter } from './dates'
import { humanizeMinutes } from './dates'

const SUNDAY = 0
const SATURDAY = 6
const LAST_NTH = -1
const HIGHEST_NTH_LABEL = 4
const WORKDAYS = '1,2,3,4,5'
const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 1440

/** In Portuguese, Saturday and Sunday are masculine ("no primeiro sábado"); the other weekdays are feminine. */
function isMasculineWeekday(weekday: number): boolean {
    return weekday === SUNDAY || weekday === SATURDAY
}

export function nthLabel(nth: number, weekday: number, t: TFunction): string {
    const key = nth === LAST_NTH ? 'last' : String(Math.min(HIGHEST_NTH_LABEL, nth))
    if (isMasculineWeekday(weekday)) return t(`recurrence.nth_m.${key}` as 'recurrence.nth_m.1')
    return t(`recurrence.nth_f.${key}` as 'recurrence.nth_f.1')
}

export function onNth(nth: number, weekday: number, t: TFunction, dates: DateFormatter): string {
    const params = { nth: nthLabel(nth, weekday, t), weekday: dates.weekdayLong(weekday) }
    if (isMasculineWeekday(weekday)) return t('recurrence.onNth_m', params)
    return t('recurrence.onNth_f', params)
}

function describeWeekly(
    recurrence: Recurrence,
    count: number,
    start: Date,
    t: TFunction,
    dates: DateFormatter
): string {
    const selectedDays = recurrence.byWeekday?.length ? recurrence.byWeekday : [start.getDay()]
    const sortedDays = selectedDays.slice().sort((first, second) => first - second)
    const isWorkdays = sortedDays.join() === WORKDAYS
    if (isWorkdays && count === 1) return t('recurrence.workdays')

    const days = isWorkdays
        ? t('recurrence.workdaysList')
        : sortedDays.map((weekday) => dates.weekdayShort(weekday)).join(', ')
    return t('recurrence.weekly', { count, days })
}

function describeMonthly(
    recurrence: Recurrence,
    count: number,
    start: Date,
    t: TFunction,
    dates: DateFormatter
): string {
    const when =
        recurrence.monthlyMode === 'weekday'
            ? onNth(recurrence.monthlyNth ?? nthWeekdayOf(start).nth, start.getDay(), t, dates)
            : t('recurrence.onDay', { day: start.getDate() })
    return t('recurrence.monthly', { count, when })
}

function describeFrequency(
    recurrence: Recurrence,
    count: number,
    start: Date,
    t: TFunction,
    dates: DateFormatter
): string {
    switch (recurrence.freq) {
        case 'daily':
            return t('recurrence.daily', { count })
        case 'weekly':
            return describeWeekly(recurrence, count, start, t, dates)
        case 'monthly':
            return describeMonthly(recurrence, count, start, t, dates)
        default:
            return t('recurrence.yearly', { count, when: t('recurrence.onDate', { date: dates.monthDay(start) }) })
    }
}

function describeEnd(recurrence: Recurrence, t: TFunction, dates: DateFormatter): string {
    if (recurrence.until) return t('recurrence.until', { date: dates.date(recurrence.until, true) })
    if (recurrence.count) return t('recurrence.times', { count: recurrence.count })
    return ''
}

export function describeRecurrence(
    recurrence: Recurrence | undefined,
    start: Date,
    t: TFunction,
    dates: DateFormatter
): string {
    if (!recurrence) return t('recurrence.none')
    const count = Math.max(1, recurrence.interval || 1)
    return describeFrequency(recurrence, count, start, t, dates) + describeEnd(recurrence, t, dates)
}

export function describeReminder(minutes: number, allDay: boolean, allDayHour: number, t: TFunction): string {
    const hour = String(allDayHour).padStart(2, '0')
    if (allDay && minutes === 0) return t('reminder.allDayOnDay', { hour })
    if (allDay && minutes % MINUTES_PER_DAY === 0) {
        return t('reminder.allDayBefore', { time: humanizeMinutes(minutes, t), hour })
    }
    if (minutes === 0) return t('reminder.atStart')
    if (minutes < MINUTES_PER_HOUR || minutes % MINUTES_PER_HOUR !== 0) {
        return t('reminder.minutesBefore', { count: minutes })
    }
    return t('reminder.before', { time: humanizeMinutes(minutes, t) })
}
