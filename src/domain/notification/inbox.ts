import { toLocalDate, type LocalDate } from '../shared/date'
import type { AppNotification, NotificationKind, NotificationSource } from './notification'

/** Chips of the Notifications page. "all" also covers the generic "updated" kind, which has no chip of its own. */
export type NotificationFilter =
    'all' | 'mentions' | 'comments' | 'status' | 'issues' | 'unqueued' | 'queries' | 'reminders'

export const NOTIFICATION_FILTERS: NotificationFilter[] = [
    'all',
    'mentions',
    'comments',
    'status',
    'issues',
    'unqueued',
    'queries',
    'reminders'
]

const FILTER_KINDS: Record<Exclude<NotificationFilter, 'all'>, NotificationKind[]> = {
    mentions: ['mention'],
    comments: ['comment'],
    status: ['status'],
    issues: ['new_issue', 'assigned'],
    unqueued: ['unqueued'],
    queries: ['query'],
    reminders: ['reminder']
}

export interface InboxCriteria {
    filter: NotificationFilter
    onlyUnread: boolean
    /** Only what this monitor saw; undefined = every monitor. */
    monitorId?: string
}

export function matchesFilter(notification: AppNotification, filter: NotificationFilter): boolean {
    if (filter === 'all') return true
    return FILTER_KINDS[filter].includes(notification.kind)
}

function seenBy(notification: AppNotification, monitorId: string | undefined): boolean {
    if (!monitorId) return true
    const sources = notification.sources ?? []
    return sources.some((source) => source.monitorId === monitorId)
}

function matchesBaseCriteria(notification: AppNotification, criteria: Omit<InboxCriteria, 'filter'>): boolean {
    const unreadOk = !criteria.onlyUnread || !notification.read
    return unreadOk && seenBy(notification, criteria.monitorId)
}

export function filterNotifications(notifications: AppNotification[], criteria: InboxCriteria): AppNotification[] {
    return notifications.filter(
        (notification) => matchesBaseCriteria(notification, criteria) && matchesFilter(notification, criteria.filter)
    )
}

/** How many notifications each chip would show, given the other criteria (unread, monitor). */
export function countByFilter(
    notifications: AppNotification[],
    criteria: Omit<InboxCriteria, 'filter'>
): Record<NotificationFilter, number> {
    const counts = Object.fromEntries(NOTIFICATION_FILTERS.map((filter) => [filter, 0])) as Record<
        NotificationFilter,
        number
    >
    const candidates = notifications.filter((notification) => matchesBaseCriteria(notification, criteria))
    for (const notification of candidates) {
        for (const filter of NOTIFICATION_FILTERS) {
            if (matchesFilter(notification, filter)) counts[filter] += 1
        }
    }
    return counts
}

/** Monitors that produced at least one notification, in order of first appearance. */
export function notificationSources(notifications: AppNotification[]): NotificationSource[] {
    const byId = new Map<string, NotificationSource>()
    for (const notification of notifications) {
        for (const source of notification.sources ?? []) {
            if (!byId.has(source.monitorId)) byId.set(source.monitorId, source)
        }
    }
    return [...byId.values()]
}

export interface NotificationDay {
    date: LocalDate
    items: AppNotification[]
}

/** Groups by the local calendar day of `createdAt`; days and items keep the incoming order (newest first). */
export function groupByDay(notifications: AppNotification[]): NotificationDay[] {
    const byDate = new Map<LocalDate, AppNotification[]>()
    for (const notification of notifications) {
        const date = toLocalDate(new Date(notification.createdAt))
        const items = byDate.get(date) ?? []
        items.push(notification)
        byDate.set(date, items)
    }
    return [...byDate].map(([date, items]) => ({ date, items }))
}
