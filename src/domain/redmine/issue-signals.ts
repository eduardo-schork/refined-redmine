import { daysUntil } from '../shared/date'
import type { Issue, Named } from './entities'
import { DEFAULT_ISSUE_STYLE, type IssueStyleRules } from './issue-style'
import { isStale } from './queue'

export type PriorityLevel = 'urgent' | 'high' | 'normal' | 'low'

// Redmine priority names, in Portuguese or English; the ids differ between installations.
const PRIORITY_PATTERNS: [PriorityLevel, RegExp][] = [
    ['urgent', /imediat|urgent|crít|critic|immediate/i],
    ['high', /alta|high/i],
    ['low', /baixa|low/i]
]

/** The user's choice for this priority wins over the inference from the name. */
export function priorityLevel(priority: Named, rules?: IssueStyleRules): PriorityLevel {
    const chosen = rules?.priorityLevels[priority.id]
    if (chosen) return chosen
    const match = PRIORITY_PATTERNS.find(([, pattern]) => pattern.test(priority.name))
    return match ? match[0] : 'normal'
}

export const isHighPriority = (issue: Issue, rules?: IssueStyleRules) =>
    ['urgent', 'high'].includes(priorityLevel(issue.priority, rules))

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none'

/** How close the due date is. Closed issues and issues without a due date have none. */
export function dueState(issue: Issue, now: Date, dueSoonDays = DEFAULT_ISSUE_STYLE.dueSoonDays): DueState {
    if (!issue.due_date || issue.status.is_closed) return 'none'
    const days = daysUntil(issue.due_date, now)
    if (days < 0) return 'overdue'
    if (days === 0) return 'today'
    if (days <= dueSoonDays) return 'soon'
    return 'later'
}

/** Signals shown as counters on a board; each one also works as a quick filter. */
export type IssueSignal = 'overdue' | 'highPriority' | 'stale' | 'unassigned'

export const ISSUE_SIGNALS: IssueSignal[] = ['overdue', 'highPriority', 'stale', 'unassigned']

export interface SignalOptions {
    staleDays: number
    now: Date
    rules?: IssueStyleRules
}

const SIGNAL_TESTS: Record<IssueSignal, (issue: Issue, options: SignalOptions) => boolean> = {
    overdue: (issue, { now }) => dueState(issue, now) === 'overdue',
    highPriority: (issue, { rules }) => !issue.status.is_closed && isHighPriority(issue, rules),
    stale: (issue, { staleDays, now }) => !issue.status.is_closed && isStale(issue, staleDays, now),
    unassigned: (issue) => !issue.status.is_closed && !issue.assigned_to
}

export function hasSignal(issue: Issue, signal: IssueSignal, options: SignalOptions): boolean {
    return SIGNAL_TESTS[signal](issue, options)
}

export function countSignals(issues: Issue[], options: SignalOptions): Record<IssueSignal, number> {
    const count = (signal: IssueSignal) => issues.filter((issue) => hasSignal(issue, signal, options)).length
    return {
        overdue: count('overdue'),
        highPriority: count('highPriority'),
        stale: count('stale'),
        unassigned: count('unassigned')
    }
}
