/** Issues opened lately, for the quick search. A per-computer convenience: losing it costs nothing. */
export interface RecentIssue {
    id: number
    subject: string
    project?: string
}

const STORAGE_KEY = 'refined-redmine.recent-issues'
const MAX_RECENT = 8

export function recentIssues(): RecentIssue[] {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
        return Array.isArray(stored) ? stored : []
    } catch {
        return []
    }
}

export function rememberIssue(issue: RecentIssue): void {
    const others = recentIssues().filter((recent) => recent.id !== issue.id)
    const updated = [issue, ...others].slice(0, MAX_RECENT)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
        // Storage unavailable (private mode, quota): the list simply is not kept.
    }
}
