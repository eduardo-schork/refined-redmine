export interface MonitorStatus {
    running: boolean
    lastCheckAt?: string
    nextCheckAt?: string
    paused?: 'schedule' | 'no-credentials'
    /** Last error of the cycle, with its context (e.g. the query name). */
    lastError?: { code: string; params: Record<string, string | number>; context?: string }
}
