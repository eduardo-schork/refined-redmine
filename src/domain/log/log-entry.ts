export type LogLevel = 'info' | 'warn' | 'error'

/** One request to Redmine. `url` is the path + query string (the API key travels in a header, never here). */
export interface HttpLogEntry {
    type: 'http'
    method: string
    url: string
    status?: number
    durationMs: number
    /** Size of the response body. */
    bytes: number
    attempt: number
    errorCode?: string
}

export type MonitorLogEvent =
    | 'cycleFinished'
    | 'cycleFailed'
    | 'cyclePaused'
    | 'monitorChecked'
    | 'monitorFailed'
    | 'monitorSkipped'
    | 'monitorPartial'
    | 'journalLimit'

/** A monitor step. The text is built from `event` + `params` in the current language. */
export interface MonitorLogEntry {
    type: 'monitor'
    event: MonitorLogEvent
    params?: Record<string, string | number>
}

export type LogRecord = HttpLogEntry | MonitorLogEntry

export type LogEntry = LogRecord & {
    id: string
    at: string
    level: LogLevel
}

export function httpLevel(entry: HttpLogEntry): LogLevel {
    const failed = entry.errorCode !== undefined
    if (failed) return 'error'
    return 'info'
}

export interface LogSummary {
    requests: number
    errors: number
    averageMs: number
    totalBytes: number
}

export function summarizeLog(entries: LogEntry[]): LogSummary {
    const requests = entries.filter((entry): entry is LogEntry & HttpLogEntry => entry.type === 'http')
    const errors = entries.filter((entry) => entry.level === 'error').length
    const totalMs = requests.reduce((sum, request) => sum + request.durationMs, 0)
    const totalBytes = requests.reduce((sum, request) => sum + request.bytes, 0)
    const averageMs = requests.length ? Math.round(totalMs / requests.length) : 0
    return { requests: requests.length, errors, averageMs, totalBytes }
}
