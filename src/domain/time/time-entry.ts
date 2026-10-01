import type { Named } from '../redmine/entities'
import { AppError } from '../shared/errors'
import type { LocalDate } from '../shared/date'

/** A time entry as Redmine returns it (/time_entries.json). */
export interface TimeEntry {
    id: number
    project: Named
    issue?: { id: number }
    user: Named
    activity: Named
    hours: number
    comments: string
    spent_on: LocalDate
    created_on: string
    updated_on: string
}

/** Kind of work of a time entry (Development, Meeting…), a Redmine enumeration. Not the issue. */
export interface TimeEntryActivity extends Named {
    is_default?: boolean
    active?: boolean
}

/** What the person types to log time. */
export interface TimeEntryDraft {
    issueId: number
    spentOn: LocalDate
    hours: number
    activityId?: number
    comments: string
}

export const MAX_HOURS_PER_ENTRY = 24

const DECIMAL = /^(\d+(?:[.,]\d+)?)\s*h?$/i
const CLOCK = /^(\d+):([0-5]?\d)$/
const HOURS_AND_MINUTES = /^(\d+)\s*h\s*(\d+)\s*(?:m|min)?$/i
const MINUTES_ONLY = /^(\d+)\s*(?:m|min)$/i

const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100

/** Minutes typed in any of the accepted forms; null when the text is not one of them. */
function minutesOf(text: string): number | null {
    const decimal = DECIMAL.exec(text)
    if (decimal) return Number(decimal[1].replace(',', '.')) * 60
    const clock = CLOCK.exec(text) ?? HOURS_AND_MINUTES.exec(text)
    if (clock) return Number(clock[1]) * 60 + Number(clock[2])
    const minutes = MINUTES_ONLY.exec(text)
    if (minutes) return Number(minutes[1])
    return null
}

/**
 * Hours typed as "1,5", "1.5", "2h", "1:30", "1h30", "1h 30m" or "90m". Returns hours with two decimals, or null
 * when the text is not a duration.
 */
export function parseHours(typed: string): number | null {
    const text = typed.trim()
    if (!text) return null
    const minutes = minutesOf(text)
    if (minutes === null || !Number.isFinite(minutes)) return null
    return toHours(minutes)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(date: LocalDate): boolean {
    if (!ISO_DATE.test(date)) return false
    const [year, month, day] = date.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

/**
 * Time entries: more than 0 and at most 24 hours, a real date (any date, past or future), a comment (required by
 * the team) and an issue.
 */
export function assertValidDraft(draft: TimeEntryDraft): void {
    const validHours = draft.hours > 0 && draft.hours <= MAX_HOURS_PER_ENTRY
    if (!validHours) throw new AppError('time.hours', { max: MAX_HOURS_PER_ENTRY })
    if (!isRealDate(draft.spentOn)) throw new AppError('time.date')
    if (!draft.comments.trim()) throw new AppError('time.comment')
    if (!Number.isInteger(draft.issueId) || draft.issueId <= 0) throw new AppError('time.issue')
}

/** The activity used last, while it still exists; otherwise Redmine's default; otherwise the first one. */
export function defaultActivityId(activities: TimeEntryActivity[], lastUsedId?: number): number | undefined {
    const lastUsed = activities.find((activity) => activity.id === lastUsedId)
    if (lastUsed) return lastUsed.id
    const redmineDefault = activities.find((activity) => activity.is_default)
    return (redmineDefault ?? activities[0])?.id
}
