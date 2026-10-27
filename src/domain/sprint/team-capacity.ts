import { isPendingWork, remainingHours } from '../board/remaining-work'
import type { Issue } from '../redmine/entities'
import type { IssueStyleRules } from '../redmine/issue-style'
import { addDays, parseLocal } from '../shared/date'
import { scheduledHoursPerDay, splitWorkTime, type WorkSchedule } from '../time/business-hours'
import type { TeamMember } from '../time/team'

export interface MemberCapacity {
    member: TeamMember
    /** Issues still with the dev (`isPendingWork`), with or without an estimate. */
    pendingIssues: number
    remainingHours: number
    /** Working hours from now to the end of the dev deadline day. */
    availableHours: number
    /** Available minus remaining: positive is room for more work (the backlog), negative is time missing. */
    balance: number
}

export type CapacityTotals = Omit<MemberCapacity, 'member'>

export interface TeamCapacity {
    rows: MemberCapacity[]
    total: CapacityTotals
}

export interface TeamCapacityInput {
    issues: Issue[]
    members: TeamMember[]
    /** 'YYYY-MM-DD', estimated: hours before it belong to the previous sprint. */
    devStart?: string
    /** 'YYYY-MM-DD': its whole day still counts. */
    devDeadline: string
    now: Date
    schedule: WorkSchedule
    rules?: IssueStyleRules
}

const roundHours = (hours: number) => Math.round(hours * 100) / 100

/** From the start of development, or from now when it already started. */
function windowStart(devStart: string | undefined, now: Date): Date {
    if (!devStart) return now
    const start = parseLocal(devStart)
    return start > now ? start : now
}

/**
 * The team's working hours in the sprint's development window against the hours their issues still need. An
 * upcoming sprint counts only its own window: what the current sprint still lacks is not taken off. Everyone in the
 * team has a line, also without issues: that is the time free for more work. Holidays and absences are not known.
 */
export function teamCapacity(input: TeamCapacityInput): TeamCapacity {
    const deadlineEnd = addDays(parseLocal(input.devDeadline), 1)
    const from = windowStart(input.devStart, input.now)
    const scheduleHours = splitWorkTime(from, deadlineEnd, input.schedule).business
    const hoursPerDay = scheduledHoursPerDay(input.schedule)
    const rows = input.members.map((member) => {
        const own = input.issues.filter((issue) => issue.assigned_to?.id === member.id)
        const pending = own.filter((issue) => isPendingWork(issue, input.rules))
        const remaining = roundHours(pending.reduce((sum, issue) => sum + remainingHours(issue, input.rules), 0))
        // Someone with their own hours per day gets the same share of the schedule's hours.
        const share = member.hoursPerDay && hoursPerDay ? member.hoursPerDay / hoursPerDay : 1
        const available = roundHours(scheduleHours * share)
        return {
            member,
            pendingIssues: pending.length,
            remainingHours: remaining,
            availableHours: available,
            balance: roundHours(available - remaining)
        }
    })
    return { rows, total: totalsOf(rows) }
}

function totalsOf(rows: MemberCapacity[]): CapacityTotals {
    const sum = (pick: (row: MemberCapacity) => number) => roundHours(rows.reduce((total, row) => total + pick(row), 0))
    return {
        pendingIssues: sum((row) => row.pendingIssues),
        remainingHours: sum((row) => row.remainingHours),
        availableHours: sum((row) => row.availableHours),
        balance: sum((row) => row.balance)
    }
}
