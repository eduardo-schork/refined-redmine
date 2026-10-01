import type { Issue, IssueStatus } from '../redmine/entities'
import { priorityLevel, type PriorityLevel } from '../redmine/issue-signals'
import type { IssueStyleRules } from '../redmine/issue-style'
import { compareVersions } from '../sprint/sprint-classifier'
import { NONE } from './quick-filter'

export type ListColumn = 'id' | 'tracker' | 'status' | 'priority' | 'subject' | 'assignee' | 'version' | 'due'
export type SortDirection = 'asc' | 'desc'
export type ListGroupBy = 'version' | 'status' | 'assignee' | 'tracker' | 'none'

export interface ListSort {
    column: ListColumn
    direction: SortDirection
}

/** Like Redmine's issue list: the most urgent first. */
export const DEFAULT_LIST_SORT: ListSort = { column: 'priority', direction: 'desc' }

export interface IssueGroup {
    key: string
    /** Undefined for the group without a value (no version, no assignee). */
    label?: string
    issues: Issue[]
}

const PRIORITY_RANK: Record<PriorityLevel, number> = { low: 0, normal: 1, high: 2, urgent: 3 }

interface SortContext {
    rules?: IssueStyleRules
    /** Redmine's status order (position in the status list). */
    statusOrder: number[]
}

const byText = (first = '', second = '') => first.localeCompare(second, undefined, { sensitivity: 'base' })

/** Ascending comparison per column, between issues that both have a value. */
const COMPARE: Record<ListColumn, (first: Issue, second: Issue, context: SortContext) => number> = {
    id: (first, second) => first.id - second.id,
    tracker: (first, second) => byText(first.tracker.name, second.tracker.name),
    status: (first, second, context) =>
        context.statusOrder.indexOf(first.status.id) - context.statusOrder.indexOf(second.status.id),
    priority: (first, second, context) =>
        PRIORITY_RANK[priorityLevel(first.priority, context.rules)] -
            PRIORITY_RANK[priorityLevel(second.priority, context.rules)] || first.priority.id - second.priority.id,
    subject: (first, second) => byText(first.subject, second.subject),
    assignee: (first, second) => byText(first.assigned_to?.name, second.assigned_to?.name),
    version: (first, second) => compareVersions(first.fixed_version?.name ?? '', second.fixed_version?.name ?? ''),
    due: (first, second) => (first.due_date ?? '').localeCompare(second.due_date ?? '')
}

/** Columns that can be empty; empty values go last whatever the direction, as in Redmine. */
const IS_EMPTY: Partial<Record<ListColumn, (issue: Issue) => boolean>> = {
    assignee: (issue) => !issue.assigned_to,
    version: (issue) => !issue.fixed_version,
    due: (issue) => !issue.due_date
}

/** Sorted copy; ties keep the most recently updated first. */
export function sortIssues(issues: Issue[], sort: ListSort, context: SortContext): Issue[] {
    const sign = sort.direction === 'asc' ? 1 : -1
    const isEmpty = IS_EMPTY[sort.column] ?? (() => false)
    return [...issues].sort((first, second) => {
        const emptyLast = Number(isEmpty(first)) - Number(isEmpty(second))
        if (emptyLast) return emptyLast
        const byColumn = sign * COMPARE[sort.column](first, second, context)
        return byColumn || second.updated_on.localeCompare(first.updated_on)
    })
}

/** The next sort after clicking a column header: same column flips; another starts descending for priority/due. */
export function nextSort(current: ListSort, column: ListColumn): ListSort {
    if (current.column === column) return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    const startsDescending = column === 'priority'
    return { column, direction: startsDescending ? 'desc' : 'asc' }
}

const GROUP_KEY: Record<Exclude<ListGroupBy, 'none'>, (issue: Issue) => { key: string; label?: string }> = {
    version: (issue) => ({
        key: issue.fixed_version ? String(issue.fixed_version.id) : NONE,
        label: issue.fixed_version?.name
    }),
    status: (issue) => ({ key: String(issue.status.id), label: issue.status.name }),
    assignee: (issue) => ({
        key: issue.assigned_to ? String(issue.assigned_to.id) : NONE,
        label: issue.assigned_to?.name
    }),
    tracker: (issue) => ({ key: String(issue.tracker.id), label: issue.tracker.name })
}

function groupOrder(groupBy: Exclude<ListGroupBy, 'none'>, statuses: IssueStatus[]) {
    const statusIndex = (key: string) => statuses.findIndex((status) => String(status.id) === key)
    return (first: IssueGroup, second: IssueGroup) => {
        const noneLast = Number(first.key === NONE) - Number(second.key === NONE)
        if (noneLast) return noneLast
        if (groupBy === 'version') return compareVersions(first.label ?? '', second.label ?? '')
        if (groupBy === 'status') return statusIndex(first.key) - statusIndex(second.key)
        return byText(first.label, second.label)
    }
}

/**
 * Groups of the (already sorted) issues, keeping their order inside each group. Versions in version order
 * (3.9 < 3.10), statuses in Redmine's order, people and types by name; the group without a value goes last.
 */
export function groupIssues(issues: Issue[], groupBy: ListGroupBy, statuses: IssueStatus[]): IssueGroup[] {
    if (groupBy === 'none') return [{ key: 'all', issues }]
    const groups = new Map<string, IssueGroup>()
    for (const issue of issues) {
        const { key, label } = GROUP_KEY[groupBy](issue)
        const group = groups.get(key) ?? { key, label, issues: [] }
        group.issues.push(issue)
        groups.set(key, group)
    }
    return [...groups.values()].sort(groupOrder(groupBy, statuses))
}
