import type { Issue } from '../redmine/entities'
import type { IssueStyleRules } from '../redmine/issue-style'
import { statusTone, type StatusTone } from '../redmine/status-tone'

/**
 * Status families whose issues are still the dev's work. "Review" counts: an issue awaiting approval was handed to
 * the dev, who still accepts or rejects it. Testing, done and rejected issues are past the dev.
 */
const PENDING_TONES: ReadonlySet<StatusTone> = new Set(['new', 'progress', 'blocked', 'review'])

export function isPendingWork(issue: Issue, rules?: IssueStyleRules): boolean {
    return PENDING_TONES.has(statusTone(issue.status, rules))
}

/** Hours still to do: the estimate minus the share Redmine says is done; 0 for issues past the dev. */
export function remainingHours(issue: Issue, rules?: IssueStyleRules): number {
    if (!isPendingWork(issue, rules)) return 0
    const estimate = issue.estimated_hours ?? 0
    const shareLeft = (100 - (issue.done_ratio ?? 0)) / 100
    return estimate * shareLeft
}
