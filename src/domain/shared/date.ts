/**
 * "Floating" dates in local time (no time zone): 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm'.
 * It is the same model as Redmine (due_date) and the local calendar.
 */
export type LocalDate = string
export type LocalDateTime = string

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
const pad = (value: number) => String(value).padStart(2, '0')

export function parseLocal(value: string): Date {
    const [datePart, timePart] = value.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes] = (timePart ?? '00:00').split(':').map(Number)
    return new Date(year, month - 1, day, hours || 0, minutes || 0)
}

export function toLocalDate(date: Date): LocalDate {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toLocalDateTime(date: Date): LocalDateTime {
    return `${toLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Adds days while preserving the local time. */
export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes())
}

export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * MINUTE_MS)
}

export function daysBetween(from: Date, to: Date): number {
    const elapsedMs = startOfDay(to).getTime() - startOfDay(from).getTime()
    // Rounding absorbs the 23h/25h days around daylight saving changes.
    return Math.round(elapsedMs / DAY_MS)
}

export function sameDay(first: Date, second: Date): boolean {
    const sameYear = first.getFullYear() === second.getFullYear()
    const sameMonth = first.getMonth() === second.getMonth()
    return sameYear && sameMonth && first.getDate() === second.getDate()
}

export function daysInMonth(year: number, month: number): number {
    const lastDayOfMonth = new Date(year, month + 1, 0)
    return lastDayOfMonth.getDate()
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1): Date {
    const day = startOfDay(date)
    const daysSinceWeekStart = (day.getDay() - weekStartsOn + 7) % 7
    return addDays(day, -daysSinceWeekStart)
}

/** First day shown in a month grid (6 weeks). */
export function monthGridStart(date: Date, weekStartsOn: 0 | 1): Date {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    return startOfWeek(firstOfMonth, weekStartsOn)
}

/** Calendar days between `today` and `date` (negative = already passed). */
export function daysUntil(date: LocalDate, today: Date): number {
    return daysBetween(today, parseLocal(date))
}

/** Whole days since an ISO instant. */
export function daysSince(iso: string, now: Date): number {
    const elapsedMs = now.getTime() - new Date(iso).getTime()
    return Math.floor(elapsedMs / DAY_MS)
}
