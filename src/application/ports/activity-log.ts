import type { LogEntry, LogLevel, LogRecord } from '@domain/log/log-entry'

/** Technical history of requests and monitor cycles, kept in a file next to the app data. */
export interface ActivityLog {
    write(record: LogRecord, level?: LogLevel): void
    /** Newest first. */
    list(limit?: number): LogEntry[]
    clear(): void
}
