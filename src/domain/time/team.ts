import type { Named } from '../redmine/entities'
import { AppError } from '../shared/errors'
import { addDays, parseLocal, toLocalDate, type LocalDate } from '../shared/date'
import type { TimeEntry } from './time-entry'

/** A group of people whose hours are seen together. Kept only in the app; members come from project memberships. */
export interface Team {
    id: string
    name: string
    members: Named[]
}

export const MAX_TEAM_MEMBERS = 60

export function assertValidTeam(team: Team): void {
    if (!team.name.trim()) throw new AppError('team.nameRequired')
    if (!team.members.length) throw new AppError('team.noMembers')
    if (team.members.length > MAX_TEAM_MEMBERS) throw new AppError('team.tooMany', { max: MAX_TEAM_MEMBERS })
}

export type TeamPeriod = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth'

/** The days of a preset period; "this week" and "this month" stop today. Weeks start on Monday. */
export function periodRange(period: TeamPeriod, today: Date): { from: LocalDate; to: LocalDate } {
    const mondayOffset = (today.getDay() + 6) % 7
    const monday = addDays(today, -mondayOffset)
    const ranges: Record<TeamPeriod, () => { from: Date; to: Date }> = {
        today: () => ({ from: today, to: today }),
        thisWeek: () => ({ from: monday, to: today }),
        lastWeek: () => ({ from: addDays(monday, -7), to: addDays(monday, -1) }),
        thisMonth: () => ({ from: new Date(today.getFullYear(), today.getMonth(), 1), to: today })
    }
    const range = ranges[period]()
    return { from: toLocalDate(range.from), to: toLocalDate(range.to) }
}

/** Every day from `from` to `to`, inclusive. */
export function daysOf(from: LocalDate, to: LocalDate): LocalDate[] {
    const days: LocalDate[] = []
    for (let day = parseLocal(from); toLocalDate(day) <= to; day = addDays(day, 1)) days.push(toLocalDate(day))
    return days
}

const isWorkday = (day: LocalDate) => {
    const weekday = parseLocal(day).getDay()
    return weekday !== 0 && weekday !== 6
}

const roundHours = (hours: number) => Math.round(hours * 100) / 100

export interface TeamRow {
    member: Named
    byDay: Record<LocalDate, number>
    total: number
}

export interface TeamSheet {
    days: LocalDate[]
    rows: TeamRow[]
    dayTotals: Record<LocalDate, number>
    total: number
    /** Total split by every member, including those who logged nothing. */
    perPerson: number
    /** Per member and per weekday (Monday to Friday; holidays are not known). */
    perPersonPerWorkday: number
    entryCount: number
    contributors: number
}

/** People × days with totals, only for the team's members and the period's days. */
export function teamSheet(entries: TimeEntry[], members: Named[], days: LocalDate[]): TeamSheet {
    const dayset = new Set(days)
    const memberIds = new Set(members.map((member) => member.id))
    const inside = entries.filter((entry) => dayset.has(entry.spent_on) && memberIds.has(entry.user.id))
    const rows = members.map((member) => memberRow(member, inside))
    const dayTotals = Object.fromEntries(
        days.map((day) => [day, sumHours(inside.filter((entry) => entry.spent_on === day))])
    )
    const total = sumHours(inside)
    const workdays = days.filter(isWorkday).length
    const people = Math.max(members.length, 1)
    return {
        days,
        rows,
        dayTotals,
        total,
        perPerson: roundHours(total / people),
        perPersonPerWorkday: workdays ? roundHours(total / people / workdays) : 0,
        entryCount: inside.length,
        contributors: new Set(inside.map((entry) => entry.user.id)).size
    }
}

function memberRow(member: Named, entries: TimeEntry[]): TeamRow {
    const own = entries.filter((entry) => entry.user.id === member.id)
    const byDay: Record<LocalDate, number> = {}
    for (const entry of own) byDay[entry.spent_on] = roundHours((byDay[entry.spent_on] ?? 0) + entry.hours)
    return { member, byDay, total: sumHours(own) }
}

const sumHours = (entries: TimeEntry[]) => roundHours(entries.reduce((sum, entry) => sum + entry.hours, 0))

export type EntryGrouping = 'issue' | 'activity'

export interface EntryGroup {
    key: string
    issueId?: number
    activity?: string
    hours: number
    entries: TimeEntry[]
}

/** Entries by issue or by kind of work, most hours first; newest entries first inside each group. */
export function groupEntries(entries: TimeEntry[], by: EntryGrouping): EntryGroup[] {
    const groups = new Map<string, EntryGroup>()
    for (const entry of entries) {
        const key = by === 'issue' ? `issue:${entry.issue?.id ?? 0}` : `activity:${entry.activity.name}`
        const group = groups.get(key) ?? {
            key,
            issueId: by === 'issue' ? entry.issue?.id : undefined,
            activity: by === 'activity' ? entry.activity.name : undefined,
            hours: 0,
            entries: []
        }
        group.hours = roundHours(group.hours + entry.hours)
        group.entries.push(entry)
        groups.set(key, group)
    }
    const sorted = [...groups.values()].sort((first, second) => second.hours - first.hours)
    for (const group of sorted) group.entries.sort((first, second) => second.spent_on.localeCompare(first.spent_on))
    return sorted
}

/** The cells a click on the grid narrows the detail to: a person, a day, or both. */
export interface TeamFocus {
    memberId?: number
    day?: LocalDate
}

export function focusedEntries(entries: TimeEntry[], focus: TeamFocus): TimeEntry[] {
    return entries.filter((entry) => {
        const personMatches = focus.memberId === undefined || entry.user.id === focus.memberId
        const dayMatches = focus.day === undefined || entry.spent_on === focus.day
        return personMatches && dayMatches
    })
}
