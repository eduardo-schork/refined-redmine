import type { TFunction } from 'i18next'
import type { SupportReport } from '@contracts/api'
import type { DateFormatter } from '@shared/i18n/format/dates'
import { describeLogEntry } from '@shared/i18n/format/log'

type MonitorName = (monitorId: string) => string

const PLATFORM_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }
const NONE = '—'

function describeMonitor(report: SupportReport, t: TFunction, dates: DateFormatter): string {
    const status = report.monitor
    const parts = [
        t('support.lastCheck', {
            time: status.lastCheckAt ? dates.format(new Date(status.lastCheckAt), DATE_TIME) : NONE
        })
    ]
    if (status.paused) parts.push(t('support.paused', { reason: t(`log.reason.${status.paused}`) }))
    if (status.lastError)
        parts.push(t('support.lastError', { code: status.lastError.code, where: status.lastError.context ?? NONE }))
    return parts.join(' · ')
}

function describeSource(monitor: SupportReport['monitors'][number], t: TFunction): string {
    const source = t(`monitors.sourceType.${monitor.source}` as 'monitors.sourceType.mine', {
        defaultValue: monitor.source
    })
    if (monitor.enabled) return source
    return `${source}, ${t('monitors.off')}`
}

const DATE_TIME: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }

/** Plain text for "Copy support information": pasted in a chat when someone reports a problem. */
export function formatSupportReport(
    report: SupportReport,
    t: TFunction,
    dates: DateFormatter,
    monitorName: MonitorName,
    locale: string
): string {
    const platform = PLATFORM_NAMES[report.app.platform] ?? report.app.platform
    const permission = t(`permission.status.${report.permission.status}`)
    const permissionReason = report.permission.reason
        ? ` (${t(`notification.permission.${report.permission.reason}`)})`
        : ''
    const monitors = report.monitors
        .map((monitor) => `${monitorName(monitor.id)} [${describeSource(monitor, t)}]`)
        .join('; ')
    const problems = report.recentProblems.map((entry) => {
        const when = dates.format(new Date(entry.at), DATE_TIME)
        return `- ${when} · ${t(`log.level.${entry.level}`)} · ${describeLogEntry(entry, t, monitorName, locale)}`
    })

    const lines = [
        t('support.title', { time: dates.format(new Date(report.generatedAt), DATE_TIME) }),
        t('support.version', { version: report.app.version, electron: report.app.electron }),
        t('support.system', { platform, arch: report.app.arch, os: report.os }),
        t('support.language', { language: report.language }),
        t('support.redmine', { host: report.redmineHost || NONE, login: report.userLogin ?? NONE }),
        t('support.monitor', { details: describeMonitor(report, t, dates) }),
        t('support.notifications', { status: `${permission}${permissionReason}` }),
        t('support.monitors', { list: monitors || NONE }),
        t('support.boards', { count: report.boardCount }),
        t('support.problems'),
        ...(problems.length ? problems : [t('support.noProblems')])
    ]
    return lines.join('\n')
}
