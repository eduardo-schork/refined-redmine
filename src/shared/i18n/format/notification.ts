import { isBoardMonitorId, MINE_MONITOR_ID } from '@domain/monitor/monitor'
import type {
    AppNotification,
    IssueChange,
    IssueRef,
    NotificationPayload,
    NotificationSource,
    QueueExitReason
} from '@domain/notification/notification'
import { parseLocal, startOfDay } from '@domain/shared/date'
import type { TFunction } from 'i18next'
import type { DateFormatter } from './dates'
import { humanizeMinutes } from './dates'

export interface NotificationText {
    title: string
    /** First line = subject; remaining lines = details. */
    body: string
}

type PayloadOf<Type extends NotificationPayload['type']> = Extract<NotificationPayload, { type: Type }>

const SEPARATOR = ' · '
const MAX_LISTED_QUERY_ISSUES = 3
const MILLISECONDS_PER_DAY = 86_400_000

export function describeChange(issueChange: IssueChange, t: TFunction): string {
    switch (issueChange.type) {
        case 'assignedToYou':
            return t('notification.change.assignedToYou')
        case 'assigneeChanged':
            return t('notification.change.assigneeChanged')
        case 'statusChanged':
            return t('notification.change.statusChanged', { from: issueChange.from, to: issueChange.to })
        case 'columnChanged':
            return t('notification.change.columnChanged', { from: issueChange.from, to: issueChange.to })
        case 'fieldChanged': {
            const fieldLabel = t(`fields.${issueChange.field}` as 'fields.subject', {
                defaultValue: issueChange.field
            })
            return t('notification.change.fieldChanged', { field: fieldLabel })
        }
        case 'attachmentAdded':
            return t('notification.change.attachmentAdded')
        case 'commented':
            return t('notification.change.commented', { excerpt: issueChange.excerpt })
        case 'mentioned':
            return t('notification.change.mentioned', { excerpt: issueChange.excerpt })
    }
}

export function describeExitReason(reason: QueueExitReason, t: TFunction): string {
    switch (reason.type) {
        case 'reassigned':
            if (!reason.to) return t('notification.exit.unassigned')
            return t('notification.exit.reassigned', { name: reason.to })
        case 'closed':
            return t('notification.exit.closed', { status: reason.status })
        case 'nowWith':
            return t('notification.exit.nowWith', { name: reason.name ?? t('common.nobody') })
        case 'status':
            return t('notification.exit.status', { status: reason.status })
    }
}

function titleWithIssue(title: string, issueId: number, t: TFunction): string {
    return t('notification.titleWithIssue', { title, id: issueId })
}

function formatIssueCreated(payload: PayloadOf<'issueCreated'>, t: TFunction): NotificationText {
    const kindLabel = payload.assignedToYou ? t('notification.newIssueToYou') : t('notification.kind.new_issue')
    const details = [payload.actor, payload.issue.tracker, payload.issue.project].filter(Boolean).join(SEPARATOR)
    return {
        title: titleWithIssue(kindLabel, payload.issue.id, t),
        body: `${payload.issue.subject}\n${details}`
    }
}

function formatIssueChanged(
    payload: PayloadOf<'issueChanged'>,
    notification: AppNotification,
    t: TFunction
): NotificationText {
    const changes = payload.changes.map((issueChange) => describeChange(issueChange, t)).join(SEPARATOR)
    return {
        title: titleWithIssue(t(`notification.kind.${notification.kind}`), payload.issue.id, t),
        body: `${payload.issue.subject}\n${payload.actor} ${changes}`
    }
}

function formatQueueExit(payload: PayloadOf<'queueExit'>, t: TFunction): NotificationText {
    const actor = payload.actor ?? t('common.someone')
    const reasons = payload.reasons.map((reason) => describeExitReason(reason, t)).join(SEPARATOR)
    const excerpt = payload.excerpt ? `${SEPARATOR}“${payload.excerpt}”` : ''
    return {
        title: titleWithIssue(t('notification.kind.unqueued'), payload.issue.id, t),
        body: `${payload.issue.subject}\n${actor} ${reasons}${excerpt}`
    }
}

function formatQueueExitHidden(payload: PayloadOf<'queueExitHidden'>, t: TFunction): NotificationText {
    return {
        title: titleWithIssue(t('notification.kind.unqueued'), payload.issueId, t),
        body: `#${payload.issueId}\n${t('notification.exit.hidden')}`
    }
}

function describeIssueList(issues: IssueRef[] | undefined, key: 'added' | 'removed', t: TFunction): string {
    if (!issues?.length) return ''
    const list = issues
        .slice(0, MAX_LISTED_QUERY_ISSUES)
        .map((issue) => `#${issue.id} ${issue.subject}`.trim())
        .join(' | ')
    const hiddenCount = issues.length - MAX_LISTED_QUERY_ISSUES
    const more = hiddenCount > 0 ? ` ${t('notification.query.more', { count: hiddenCount })}` : ''
    return `\n${t(`notification.query.${key}`, { list })}${more}`
}

function formatQueryChanged(payload: PayloadOf<'queryChanged'>, t: TFunction): NotificationText {
    const difference = payload.to - payload.from
    const sign = difference > 0 ? '+' : ''
    const added = describeIssueList(payload.added, 'added', t)
    const removed = describeIssueList(payload.removed, 'removed', t)
    return {
        title: payload.queryName,
        body: `${payload.from} → ${payload.to} (${sign}${difference})${added}${removed}`
    }
}

function formatQueryCount(payload: PayloadOf<'queryCount'>, t: TFunction): NotificationText {
    const rule = t(`notification.query.${payload.op}`, { value: payload.value })
    return { title: payload.queryName, body: t('notification.query.countReached', { count: payload.count, rule }) }
}

function describeReminderDay(start: Date, now: Date, t: TFunction, dates: DateFormatter): string {
    const dayDifference = Math.round((startOfDay(start).getTime() - startOfDay(now).getTime()) / MILLISECONDS_PER_DAY)
    if (dayDifference === 0) return t('notification.reminder.today')
    if (dayDifference === 1) return t('notification.reminder.tomorrow')
    return dates.format(start, { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function describeReminderLead(payload: PayloadOf<'reminder'>, t: TFunction): string {
    if (payload.allDay) return ''
    if (payload.minutes === 0) return `${t('notification.reminder.startingNow')}${SEPARATOR}`
    const time = humanizeMinutes(payload.minutes, t)
    return `${t('notification.reminder.inTime', { time })}${SEPARATOR}`
}

function formatReminder(
    payload: PayloadOf<'reminder'>,
    t: TFunction,
    dates: DateFormatter,
    now: Date
): NotificationText {
    const start = parseLocal(payload.start)
    const end = parseLocal(payload.end)
    const day = describeReminderDay(start, now, t, dates)
    const when = payload.allDay
        ? `${day}${SEPARATOR}${t('notification.reminder.allDay')}`
        : `${day}, ${dates.time(start)}–${dates.time(end)}`
    const location = payload.location ? `${SEPARATOR}${payload.location}` : ''
    return {
        title: `⏰ ${payload.title || t('common.untitled')}`,
        body: `${payload.title}\n${describeReminderLead(payload, t)}${when}${location}`
    }
}

/** "My issues", "board Sprint" or "monitor Bugs". Older notifications have no type: a board is told by its id. */
export function describeSource(source: NotificationSource, t: TFunction): string {
    if (source.monitorId === MINE_MONITOR_ID) return t('monitors.mine')
    const isBoard = source.sourceType === 'board' || isBoardMonitorId(source.monitorId)
    return t(isBoard ? 'notification.sourceBoard' : 'notification.sourceMonitor', { name: source.name })
}

/** Where the notification came from, e.g. "via My issues, board Sprint". */
export function describeSources(notification: AppNotification, t: TFunction): string | undefined {
    const payload = notification.payload
    // An entry/exit notification is already titled with the monitor name.
    const titleName = 'queryName' in payload ? payload.queryName : undefined
    const labels = (notification.sources ?? [])
        .filter((source) => source.monitorId === MINE_MONITOR_ID || (source.name && source.name !== titleName))
        .map((source) => describeSource(source, t))
    if (!labels.length) return undefined
    return t('notification.via', { names: labels.join(', ') })
}

/** Turns the structured notification into text in the current language. */
export function formatNotification(
    notification: AppNotification,
    t: TFunction,
    dates: DateFormatter,
    now: Date
): NotificationText {
    const payload = notification.payload
    switch (payload.type) {
        case 'issueCreated':
            return formatIssueCreated(payload, t)
        case 'issueChanged':
            return formatIssueChanged(payload, notification, t)
        case 'queueExit':
            return formatQueueExit(payload, t)
        case 'queueExitHidden':
            return formatQueueExitHidden(payload, t)
        case 'queryChanged':
            return formatQueryChanged(payload, t)
        case 'queryCount':
            return formatQueryCount(payload, t)
        case 'reminder':
            return formatReminder(payload, t, dates, now)
        case 'legacy':
            return { title: payload.title, body: payload.body }
    }
}

/** Text for the system notification: the reminder's subject is already in the title, so it is dropped from the body. */
export function systemNotificationText(
    notification: AppNotification,
    t: TFunction,
    dates: DateFormatter,
    now: Date
): NotificationText {
    const formatted = formatNotification(notification, t, dates, now)
    const via = describeSources(notification, t)
    const text = via ? { ...formatted, body: `${formatted.body}\n${via}` } : formatted
    if (notification.payload.type !== 'reminder') return text
    const detailLines = text.body.split('\n').slice(1)
    return { title: text.title, body: detailLines.join('\n') }
}
