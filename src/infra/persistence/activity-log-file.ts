import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ActivityLog } from '@application/ports/activity-log'
import type { Clock } from '@application/ports/system'
import { httpLevel, type LogEntry, type LogLevel, type LogRecord } from '@domain/log/log-entry'

const MAX_FILE_BYTES = 5 * 1024 * 1024
// When the file reaches the limit, the newest part is kept (not a full wipe).
const KEPT_FRACTION_AFTER_TRIM = 0.6
const DEFAULT_LIST_LIMIT = 2000

/** One JSON object per line: appending is cheap and a broken line does not spoil the rest. */
export class ActivityLogFile implements ActivityLog {
    private sequence = 0

    constructor(
        private readonly path: string,
        private readonly clock: Clock
    ) {}

    write(record: LogRecord, level?: LogLevel): void {
        const entry = this.toEntry(record, level)
        try {
            mkdirSync(dirname(this.path), { recursive: true })
            appendFileSync(this.path, `${JSON.stringify(entry)}\n`)
            this.trimIfTooLarge()
        } catch {
            // The log must never break the app: a failed write is simply lost.
        }
    }

    list(limit = DEFAULT_LIST_LIMIT): LogEntry[] {
        const lines = this.readLines()
        const newestLines = lines.slice(-limit).reverse()
        return newestLines.map(parseLine).filter((entry): entry is LogEntry => entry !== undefined)
    }

    clear(): void {
        if (existsSync(this.path)) writeFileSync(this.path, '')
    }

    private toEntry(record: LogRecord, level?: LogLevel): LogEntry {
        const at = this.clock.now().toISOString()
        this.sequence++
        const id = `${Date.parse(at)}-${this.sequence}`
        const defaultLevel = record.type === 'http' ? httpLevel(record) : 'info'
        return { ...record, id, at, level: level ?? defaultLevel }
    }

    private readLines(): string[] {
        if (!existsSync(this.path)) return []
        const content = readFileSync(this.path, 'utf8')
        return content.split('\n').filter(Boolean)
    }

    private trimIfTooLarge(): void {
        const size = statSync(this.path).size
        if (size <= MAX_FILE_BYTES) return
        const lines = this.readLines()
        const keptCount = Math.floor(lines.length * KEPT_FRACTION_AFTER_TRIM)
        const kept = lines.slice(-keptCount)
        writeFileSync(this.path, `${kept.join('\n')}\n`)
    }
}

function parseLine(line: string): LogEntry | undefined {
    try {
        return JSON.parse(line) as LogEntry
    } catch {
        return undefined
    }
}
