/** Last activity used to log time, to preselect it next time. A per-computer convenience: losing it costs nothing. */
const STORAGE_KEY = 'refined-redmine.last-time-activity'

export function lastActivityId(): number | undefined {
    try {
        const stored = Number(localStorage.getItem(STORAGE_KEY))
        return Number.isInteger(stored) && stored > 0 ? stored : undefined
    } catch {
        return undefined
    }
}

export function rememberActivity(activityId: number | undefined): void {
    if (!activityId) return
    try {
        localStorage.setItem(STORAGE_KEY, String(activityId))
    } catch {
        // Storage unavailable: the default activity is used next time.
    }
}
