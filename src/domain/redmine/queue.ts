import { daysSince, daysUntil } from '../shared/date'
import type { Issue } from './entities'

/** Statuses that indicate a stalled issue, by name (the convention varies between installations).
 * Matches Redmine status names in Portuguese or English. */
const BLOCKED_STATUS = /pausa|bloque|aguard|impedi|pause|block|wait/i

export const isBlockedStatus = (statusName: string) => BLOCKED_STATUS.test(statusName)

export function isOverdue(issue: Issue, today: Date): boolean {
    if (!issue.due_date || issue.status.is_closed) return false
    return daysUntil(issue.due_date, today) < 0
}

export interface QueueAnalysis {
    total: number
    /** No activity for `staleDays` days or more, or in a paused status. Oldest first. */
    stale: Issue[]
    overdue: Issue[]
    /** Overdue or due in the next 7 days, by date. */
    dueSoon: Issue[]
    byStatus: { status: string; count: number }[]
}

const DUE_SOON_DAYS = 7

function isStale(issue: Issue, staleDays: number, now: Date): boolean {
    const inactive = daysSince(issue.updated_on, now) >= staleDays
    return inactive || isBlockedStatus(issue.status.name)
}

function isDueSoon(issue: Issue, now: Date): boolean {
    if (!issue.due_date) return false
    return daysUntil(issue.due_date, now) <= DUE_SOON_DAYS
}

function countByStatus(issues: Issue[]): { status: string; count: number }[] {
    const counts = new Map<string, number>()
    for (const issue of issues) {
        const statusName = issue.status.name
        counts.set(statusName, (counts.get(statusName) ?? 0) + 1)
    }
    const entries = [...counts].map(([status, count]) => ({ status, count }))
    return entries.sort((first, second) => second.count - first.count)
}

/** Indicators of a person's work queue. */
export function analyzeQueue(issues: Issue[], options: { staleDays: number; now: Date }): QueueAnalysis {
    const { staleDays, now } = options
    const stale = issues
        .filter((issue) => isStale(issue, staleDays, now))
        .sort((first, second) => first.updated_on.localeCompare(second.updated_on))
    const dueSoon = issues
        .filter((issue) => isDueSoon(issue, now))
        .sort((first, second) => first.due_date!.localeCompare(second.due_date!))
    return {
        total: issues.length,
        stale,
        overdue: issues.filter((issue) => isOverdue(issue, now)),
        dueSoon,
        byStatus: countByStatus(issues)
    }
}
