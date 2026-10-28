import { useState } from 'react'
import { BellOff, CheckCheck, RefreshCw, Trash2 } from 'lucide-react'
import { MINE_MONITOR_ID } from '@domain/monitor/monitor'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import {
    NOTIFICATION_FILTERS,
    countByFilter,
    filterNotifications,
    notificationSources,
    type InboxCriteria,
    type NotificationFilter
} from '@domain/notification/inbox'
import type { AppNotification } from '@domain/notification/notification'
import { RedmineLinks } from '@domain/redmine/links'
import { describeSource } from '@shared/i18n/format/notification'
import {
    unreadCount,
    useClearNotifications,
    useMarkRead,
    useMarkUnread,
    useMonitorStatus,
    useNotifications,
    useRemoveNotifications,
    useRunMonitorNow
} from '@/hooks/notifications'
import { useSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { openNotification, useNavigate } from '@/lib/router'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/atoms/Button'
import { IconButton } from '@/ui/atoms/IconButton'
import { Select } from '@/ui/atoms/fields'
import { SegmentedControl } from '@/ui/molecules/SegmentedControl'
import { EmptyState } from '@/ui/molecules/surfaces'
import { useOpenIssue } from '@/ui/organisms/IssueModal'
import type { NotificationActions } from '@/ui/organisms/NotificationItem'
import { NotificationList } from '@/ui/organisms/NotificationList'
import { PageLayout } from '@/ui/templates/layouts'

const ALL_NOTIFICATIONS: InboxCriteria = { filter: 'all', onlyUnread: false }

function useNotificationActions(): NotificationActions {
    const navigate = useNavigate()
    const openIssue = useOpenIssue()
    const baseUrl = useSettings().baseUrl
    const markRead = useMarkRead()
    const markUnread = useMarkUnread()
    const remove = useRemoveNotifications()
    return {
        open: (notification: AppNotification) => {
            markRead.mutate([notification.id])
            openNotification(notification, {
                navigate,
                openIssue,
                openExternal: (url) => void api.app.openExternal(url)
            })
        },
        toggleRead: (notification: AppNotification) => {
            if (notification.read) {
                markUnread.mutate([notification.id])
                return
            }
            markRead.mutate([notification.id])
        },
        remove: (notification: AppNotification) => remove.mutate([notification.id]),
        openInRedmine: (notification: AppNotification) => {
            if (!notification.issueId) return
            void api.app.openExternal(new RedmineLinks(baseUrl).issue(notification.issueId))
        }
    }
}

function MonitorSummary({ status }: { status?: MonitorStatus }) {
    const { t, dates, error } = useI18n()
    if (!status) return null
    const lastError = status.lastError
    if (lastError) {
        const monitorName = lastError.context === MINE_MONITOR_ID ? t('monitors.mine') : lastError.context
        const message = monitorName
            ? t('notificationsPage.errorIn', { query: monitorName, message: error(lastError) })
            : error(lastError)
        return (
            <span className="truncate text-xs text-danger" title={message}>
                {message}
            </span>
        )
    }
    if (status.running) return <span className="text-xs text-muted">{t('monitor.checking')}</span>
    if (status.paused === 'schedule') return <span className="text-xs text-muted">{t('monitor.outOfHours')}</span>
    if (!status.lastCheckAt) return null
    const lastCheck = new Date(status.lastCheckAt)
    return (
        <span className="text-xs text-muted" title={dates.dateTime(status.lastCheckAt)}>
            {t('monitor.checkedAt', { time: dates.time(lastCheck) })}
        </span>
    )
}

function KindChips({
    value,
    counts,
    onChange
}: {
    value: NotificationFilter
    counts: Record<NotificationFilter, number>
    onChange: (filter: NotificationFilter) => void
}) {
    const { t } = useI18n()
    // Chips with nothing to show stay out of the way, except the one selected.
    const visible = NOTIFICATION_FILTERS.filter((filter) => filter === 'all' || filter === value || counts[filter] > 0)
    return (
        <div
            role="group"
            aria-label={t('notificationsPage.filters')}
            className="flex flex-wrap gap-1.5 @min-[75rem]/page:flex-col @min-[75rem]/page:flex-nowrap"
        >
            {visible.map((filter) => {
                const selected = filter === value
                return (
                    <button
                        key={filter}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(filter)}
                        className={cn(
                            'inline-flex h-7 cursor-default items-center gap-1.5 rounded-full border px-2.5 text-xs @min-[75rem]/page:h-8 @min-[75rem]/page:justify-between @min-[75rem]/page:rounded-md @min-[75rem]/page:text-sm',
                            selected
                                ? 'border-accent/50 bg-accent-soft font-medium'
                                : 'border-line text-muted hover:bg-panel-2 hover:text-fg'
                        )}
                    >
                        {t(`notificationsPage.filter.${filter}`)}
                        <span className="tabular-nums text-muted">{counts[filter]}</span>
                    </button>
                )
            })}
        </div>
    )
}

function MonitorSelect({
    items,
    value,
    onChange
}: {
    items: AppNotification[]
    value?: string
    onChange: (monitorId?: string) => void
}) {
    const { t } = useI18n()
    const sources = notificationSources(items)
    if (sources.length < 2) return null
    return (
        <Select
            aria-label={t('notificationsPage.allMonitors')}
            className="h-8 w-48 text-xs"
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value || undefined)}
        >
            <option value="">{t('notificationsPage.allMonitors')}</option>
            {sources.map((source) => (
                <option key={source.monitorId} value={source.monitorId}>
                    {describeSource(source, t)}
                </option>
            ))}
        </Select>
    )
}

function EmptyInbox({ hasAny, criteria, onReset }: { hasAny: boolean; criteria: InboxCriteria; onReset: () => void }) {
    const { t } = useI18n()
    const icon = <BellOff size={28} />
    if (!hasAny) {
        return <EmptyState icon={icon} title={t('notificationsPage.emptyTitle')} text={t('notificationsPage.empty')} />
    }
    const onlyUnreadHidesAll = criteria.onlyUnread && criteria.filter === 'all' && !criteria.monitorId
    const showAll = <Button onClick={onReset}>{t('notificationsPage.showAll')}</Button>
    if (onlyUnreadHidesAll) {
        return (
            <EmptyState
                icon={icon}
                title={t('notificationsPage.caughtUpTitle')}
                text={t('notificationsPage.nothingPending')}
                action={showAll}
            />
        )
    }
    return (
        <EmptyState
            icon={icon}
            title={t('notificationsPage.noMatchTitle')}
            text={t('notificationsPage.noMatch')}
            action={showAll}
        />
    )
}

export default function NotificationsPage() {
    const { t } = useI18n()
    const items = useNotifications().data ?? []
    const status = useMonitorStatus().data
    const markRead = useMarkRead()
    const clear = useClearNotifications()
    const runNow = useRunMonitorNow()
    const actions = useNotificationActions()
    const [criteria, setCriteria] = useState<InboxCriteria>(ALL_NOTIFICATIONS)
    const visible = filterNotifications(items, criteria)
    const counts = countByFilter(items, { onlyUnread: criteria.onlyUnread, monitorId: criteria.monitorId })
    const unread = unreadCount(items)
    const now = new Date()

    const updateCriteria = (patch: Partial<InboxCriteria>) => setCriteria({ ...criteria, ...patch })

    function confirmClear() {
        if (!confirm(t('notificationsPage.confirmClear'))) return
        clear.mutate()
    }

    const headerActions = (
        <>
            <Button onClick={() => runNow.mutate()} disabled={status?.running}>
                <RefreshCw size={14} className={cn(status?.running && 'animate-spin')} />{' '}
                {t('notificationsPage.checkNow')}
            </Button>
            <IconButton
                label={t('notificationsPage.markAll')}
                icon={<CheckCheck size={15} />}
                disabled={unread === 0}
                onClick={() => markRead.mutate('all')}
            />
            <IconButton
                label={t('notificationsPage.clear')}
                tone="danger"
                icon={<Trash2 size={15} />}
                disabled={items.length === 0}
                onClick={confirmClear}
            />
        </>
    )

    return (
        <PageLayout
            title={t('nav.notifications')}
            subtitle={<MonitorSummary status={status} />}
            actions={headerActions}
            width="md"
        >
            {/* Wide areas: the kinds become a column on the left, like the folders of a mail app. */}
            <div className="flex flex-col gap-4 @min-[75rem]/page:grid @min-[75rem]/page:grid-cols-[14rem_minmax(0,1fr)] @min-[75rem]/page:items-start">
                {items.length > 0 && (
                    <aside className="@min-[75rem]/page:sticky @min-[75rem]/page:top-0">
                        <KindChips
                            value={criteria.filter}
                            counts={counts}
                            onChange={(filter) => updateCriteria({ filter })}
                        />
                    </aside>
                )}
                <div className="flex min-w-0 flex-col gap-4 @min-[75rem]/page:col-start-2">
                    {items.length > 0 && (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <MonitorSelect
                                items={items}
                                value={criteria.monitorId}
                                onChange={(monitorId) => updateCriteria({ monitorId })}
                            />
                            <SegmentedControl
                                value={criteria.onlyUnread ? 'unread' : 'all'}
                                options={[
                                    { value: 'all', label: t('notificationsPage.filter.all') },
                                    { value: 'unread', label: `${t('notificationsPage.unread')} (${unread})` }
                                ]}
                                onChange={(choice) => updateCriteria({ onlyUnread: choice === 'unread' })}
                            />
                        </div>
                    )}
                    {visible.length === 0 && (
                        <div className="flex py-16">
                            <EmptyInbox
                                hasAny={items.length > 0}
                                criteria={criteria}
                                onReset={() => setCriteria(ALL_NOTIFICATIONS)}
                            />
                        </div>
                    )}
                    {visible.length > 0 && <NotificationList items={visible} now={now} actions={actions} />}
                </div>
            </div>
        </PageLayout>
    )
}
