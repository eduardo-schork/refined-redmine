import type { Issue } from '../redmine/entities'
import {
    hasSignal,
    priorityLevel,
    type IssueSignal,
    type PriorityLevel,
    type SignalOptions
} from '../redmine/issue-signals'
import { statusTone, type StatusTone } from '../redmine/status-tone'
import { remainingHours } from './remaining-work'

export interface StatusSlice {
    statusId: number
    name: string
    tone: StatusTone
    closed: boolean
    count: number
}

export interface PersonSummary {
    /** Undefined for issues without an assignee. */
    id?: number
    name?: string
    total: number
    open: number
    closed: number
    overdue: number
    highPriority: number
    stale: number
    estimatedHours: number
    /** Estimate still to do (`remainingHours`). */
    remainingHours: number
}

export interface CountSlice {
    name: string
    count: number
}

export interface PrioritySlice extends CountSlice {
    level: PriorityLevel
}

export interface BoardSummary {
    total: number
    open: number
    closed: number
    /** Closed ÷ total, 0–100. */
    closedPercent: number
    overdue: number
    highPriority: number
    stale: number
    unassigned: number
    estimatedHours: number
    /** Estimate still to do (`remainingHours`). */
    remainingHours: number
    byStatus: StatusSlice[]
    byAssignee: PersonSummary[]
    byTracker: CountSlice[]
    byPriority: PrioritySlice[]
}

const PRIORITY_RANK: Record<PriorityLevel, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

/** Most urgent first, whatever the number of issues. */
function prioritySlices(issues: Issue[], options: SignalOptions): PrioritySlice[] {
    const levels = new Map(issues.map((issue) => [issue.priority.name, priorityLevel(issue.priority, options.rules)]))
    const slices = countBy(issues, (issue) => issue.priority.name).map((slice) => ({
        ...slice,
        level: levels.get(slice.name) ?? 'normal'
    }))
    return slices.sort((first, second) => PRIORITY_RANK[first.level] - PRIORITY_RANK[second.level])
}

function countBy(issues: Issue[], nameOf: (issue: Issue) => string): CountSlice[] {
    const counts = new Map<string, number>()
    for (const issue of issues) counts.set(nameOf(issue), (counts.get(nameOf(issue)) ?? 0) + 1)
    const slices = [...counts].map(([name, count]) => ({ name, count }))
    return slices.sort((first, second) => second.count - first.count)
}

/** Statuses in the order of the board columns; statuses outside the columns go last, by number of issues. */
function statusSlices(issues: Issue[], statusOrder: number[], options: SignalOptions): StatusSlice[] {
    const slices = new Map<number, StatusSlice>()
    for (const issue of issues) {
        const existing = slices.get(issue.status.id)
        if (existing) {
            existing.count += 1
            continue
        }
        slices.set(issue.status.id, {
            statusId: issue.status.id,
            name: issue.status.name,
            tone: statusTone(issue.status, options.rules),
            closed: issue.status.is_closed,
            count: 1
        })
    }
    const position = (statusId: number) => {
        const index = statusOrder.indexOf(statusId)
        return index === -1 ? Number.MAX_SAFE_INTEGER : index
    }
    return [...slices.values()].sort(
        (first, second) => position(first.statusId) - position(second.statusId) || second.count - first.count
    )
}

function emptyPerson(issue: Issue): PersonSummary {
    return {
        id: issue.assigned_to?.id,
        name: issue.assigned_to?.name,
        total: 0,
        open: 0,
        closed: 0,
        overdue: 0,
        highPriority: 0,
        stale: 0,
        estimatedHours: 0,
        remainingHours: 0
    }
}

const signalCount = (issue: Issue, signal: IssueSignal, options: SignalOptions) =>
    hasSignal(issue, signal, options) ? 1 : 0

/** One line per assignee: most open issues first, "no assignee" last. */
function personSummaries(issues: Issue[], options: SignalOptions): PersonSummary[] {
    const people = new Map<number | undefined, PersonSummary>()
    for (const issue of issues) {
        const key = issue.assigned_to?.id
        const person = people.get(key) ?? emptyPerson(issue)
        people.set(key, person)
        person.total += 1
        person.closed += issue.status.is_closed ? 1 : 0
        person.open += issue.status.is_closed ? 0 : 1
        person.overdue += signalCount(issue, 'overdue', options)
        person.highPriority += signalCount(issue, 'highPriority', options)
        person.stale += signalCount(issue, 'stale', options)
        person.estimatedHours += issue.estimated_hours ?? 0
        person.remainingHours += remainingHours(issue, options.rules)
    }
    const unassignedLast = (person: PersonSummary) => (person.id === undefined ? 1 : 0)
    return [...people.values()].sort(
        (first, second) =>
            unassignedLast(first) - unassignedLast(second) ||
            second.open - first.open ||
            (first.name ?? '').localeCompare(second.name ?? '')
    )
}

/** Indicators of a board: totals, attention signals and the distributions shown on its summary screen. */
export function summarizeBoard(issues: Issue[], statusOrder: number[], options: SignalOptions): BoardSummary {
    const closed = issues.filter((issue) => issue.status.is_closed).length
    const count = (signal: IssueSignal) => issues.filter((issue) => hasSignal(issue, signal, options)).length
    return {
        total: issues.length,
        open: issues.length - closed,
        closed,
        closedPercent: issues.length ? Math.round((closed / issues.length) * 100) : 0,
        overdue: count('overdue'),
        highPriority: count('highPriority'),
        stale: count('stale'),
        unassigned: count('unassigned'),
        estimatedHours: issues.reduce((sum, issue) => sum + (issue.estimated_hours ?? 0), 0),
        remainingHours: issues.reduce((sum, issue) => sum + remainingHours(issue, options.rules), 0),
        byStatus: statusSlices(issues, statusOrder, options),
        byAssignee: personSummaries(issues, options),
        byTracker: countBy(issues, (issue) => issue.tracker.name),
        byPriority: prioritySlices(issues, options)
    }
}
