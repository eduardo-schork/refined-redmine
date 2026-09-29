import type { HttpLogEntry, LogEntry, MonitorLogEntry } from '@domain/log/log-entry'
import type { TFunction } from 'i18next'

const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * 1024

export function formatBytes(bytes: number, locale: string): string {
    const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 })
    if (bytes >= MEGABYTE) return `${number(bytes / MEGABYTE)} MB`
    if (bytes >= KILOBYTE) return `${number(bytes / KILOBYTE)} KB`
    return `${bytes} B`
}

export function formatMilliseconds(milliseconds: number, locale: string): string {
    if (milliseconds < 1000) return `${milliseconds} ms`
    return `${(milliseconds / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} s`
}

type MonitorName = (monitorId: string) => string

function describeReason(reason: string | number | undefined, t: TFunction): string {
    return t(`log.reason.${String(reason)}` as 'log.reason.schedule', { defaultValue: String(reason) })
}

function describeError(code: string | number | undefined, t: TFunction): string {
    return t(`errors.${String(code)}` as 'errors.unexpected', { defaultValue: String(code), detail: '', host: '' })
}

function describeMonitorEntry(entry: MonitorLogEntry, t: TFunction, monitorName: MonitorName, locale: string): string {
    const params = entry.params ?? {}
    const monitor = params.monitor === undefined ? '' : monitorName(String(params.monitor))
    const values = {
        ...params,
        monitor,
        reason: describeReason(params.reason, t),
        error: describeError(params.code, t),
        duration: formatMilliseconds(Number(params.durationMs ?? 0), locale)
    }
    return t(`log.event.${entry.event}`, values)
}

function describeHttpEntry(entry: HttpLogEntry, t: TFunction, locale: string): string {
    const status = entry.status ?? '—'
    const parts = [`${entry.method} ${entry.url}`, String(status), formatMilliseconds(entry.durationMs, locale)]
    if (entry.bytes) parts.push(formatBytes(entry.bytes, locale))
    if (entry.attempt > 1) parts.push(t('log.attempt', { attempt: entry.attempt }))
    if (entry.errorCode) parts.push(describeError(entry.errorCode, t))
    return parts.join(' · ')
}

/** One line of text for a log entry, in the current language. */
export function describeLogEntry(entry: LogEntry, t: TFunction, monitorName: MonitorName, locale: string): string {
    if (entry.type === 'http') return describeHttpEntry(entry, t, locale)
    return describeMonitorEntry(entry, t, monitorName, locale)
}
