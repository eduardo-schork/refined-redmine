import { addDays, startOfWeek, toLocalDate, type LocalDate } from '../shared/date'
import type { TimeEntry } from './time-entry'

export interface TimesheetRow {
    issueId?: number
    projectName: string
    hoursByDay: Record<LocalDate, number>
    total: number
}

export interface Timesheet {
    days: LocalDate[]
    rows: TimesheetRow[]
    dayTotals: Record<LocalDate, number>
    total: number
}

const round = (hours: number) => Math.round(hours * 100) / 100

/** The seven days of the week that contains `anchor`, from the configured first day. */
export function weekDays(anchor: Date, weekStartsOn: 0 | 1): LocalDate[] {
    const first = startOfWeek(anchor, weekStartsOn)
    return Array.from({ length: 7 }, (_, offset) => toLocalDate(addDays(first, offset)))
}

const rowKey = (entry: TimeEntry) => (entry.issue ? `issue-${entry.issue.id}` : `project-${entry.project.id}`)

/** Days × issues with the logged hours; entries outside the days are ignored. Rows by most hours first. */
export function buildTimesheet(entries: TimeEntry[], days: LocalDate[]): Timesheet {
    const inWeek = entries.filter((entry) => days.includes(entry.spent_on))
    const rows = new Map<string, TimesheetRow>()
    const dayTotals = Object.fromEntries(days.map((day) => [day, 0])) as Record<LocalDate, number>
    for (const entry of inWeek) {
        const key = rowKey(entry)
        const row = rows.get(key) ?? {
            issueId: entry.issue?.id,
            projectName: entry.project.name,
            hoursByDay: {},
            total: 0
        }
        rows.set(key, row)
        row.hoursByDay[entry.spent_on] = round((row.hoursByDay[entry.spent_on] ?? 0) + entry.hours)
        row.total = round(row.total + entry.hours)
        dayTotals[entry.spent_on] = round(dayTotals[entry.spent_on] + entry.hours)
    }
    const sortedRows = [...rows.values()].sort((first, second) => second.total - first.total)
    const total = round(inWeek.reduce((sum, entry) => sum + entry.hours, 0))
    return { days, rows: sortedRows, dayTotals, total }
}

/** Entries of one week moved to the same weekday of another week (for "repeat last week"). */
export function shiftedEntries(entries: TimeEntry[], days: number): { entry: TimeEntry; spentOn: LocalDate }[] {
    return entries.map((entry) => {
        const [year, month, day] = entry.spent_on.split('-').map(Number)
        return { entry, spentOn: toLocalDate(addDays(new Date(year, month - 1, day), days)) }
    })
}
