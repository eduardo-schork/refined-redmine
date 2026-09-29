import { useMemo } from 'react'
import { AlarmClock, ArrowRight, Hourglass, Inbox } from 'lucide-react'
import type { AppNotification } from '@domain/notification/notification'
import { analyzeQueue, isBlockedStatus } from '@domain/redmine/queue'
import type { Issue } from '@domain/redmine/entities'
import { addDays, daysSince, daysUntil, startOfDay, toLocalDate } from '@domain/shared/date'
import { type DisplayItem, useDisplayItems } from '@/hooks/calendar'
import { useMyQueue } from '@/hooks/issues'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { useNavigate } from '@/lib/router'
import { cn } from '@/lib/cn'
import { ColorDot, TextLink } from '../atoms/misc'
import { IssueRow } from '../molecules/IssueRow'
import { Alert, EmptyRow, Panel, StatTile } from '../molecules/surfaces'
import { useOpenIssue } from './IssueModal'
import { NotificationRows } from './NotificationList'

const QUEUE_PREVIEW_LIMIT = 12
const SIDE_PANEL_LIMIT = 8
const LATEST_NOTIFICATIONS_LIMIT = 6
const DUE_SOON_WARN_DAYS = 2

export function TodayAgenda() {
    const { t } = useI18n()
    const navigate = useNavigate()
    const today = useMemo(() => startOfDay(new Date()), [])
    const tomorrow = useMemo(() => addDays(today, 1), [today])
    const { items } = useDisplayItems(today, tomorrow)
    const now = Date.now()
    return (
        <Panel
            title={t('home.today')}
            count={items.length}
            action={
                <TextLink className="text-xs" onClick={() => navigate({ page: 'calendar' })}>
                    {t('home.openCalendar')}
                </TextLink>
            }
        >
            {items.map((item) => (
                <AgendaRow key={item.id} item={item} today={today} now={now} />
            ))}
            {!items.length && <EmptyRow>{t('home.nothingToday')}</EmptyRow>}
        </Panel>
    )
}

function AgendaRow({ item, today, now }: { item: DisplayItem; today: Date; now: number }) {
    const { t, dates } = useI18n()
    const navigate = useNavigate()
    const startTime = item.start.getTime()
    const endTime = item.end.getTime()
    const past = !item.allDay && endTime < now
    const current = !item.allDay && startTime <= now && endTime > now

    const openInCalendar = () => {
        navigate({
            page: 'calendar',
            date: toLocalDate(today),
            eventId: item.kind === 'event' ? item.occurrence.event.id : undefined
        })
    }

    const whenLabel = () => {
        if (current) return t('home.now')
        if (item.allDay) return t('calendar.allDay')
        return dates.range(item.start, item.end, false, '')
    }

    return (
        <button
            onClick={openInCalendar}
            className={cn(
                'flex w-full cursor-default items-center gap-3 border-t border-line px-4 py-2 text-left text-[13px] hover:bg-panel-2',
                past && 'opacity-50'
            )}
        >
            <ColorDot color={item.hex} />
            <span className={cn('w-28 shrink-0 text-xs', current ? 'font-semibold text-accent' : 'text-muted')}>
                {whenLabel()}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            {item.location && <span className="max-w-40 truncate text-xs text-muted">{item.location}</span>}
        </button>
    )
}

function useQueue() {
    const staleDays = useSettings().dashboard.staleDays
    const mine = useMyQueue()
    const queue = useMemo(() => mine.data?.items ?? [], [mine.data])
    const analysis = useMemo(() => analyzeQueue(queue, { staleDays, now: new Date() }), [queue, staleDays])
    return { mine, queue, analysis, staleDays, loaded: Boolean(mine.data) }
}

export function QueueTiles({ unread, onGoNotifications }: { unread: number; onGoNotifications: () => void }) {
    const { t } = useI18n()
    const { analysis, staleDays, loaded } = useQueue()
    const valueOrLoading = (value: number) => (loaded ? value : '…')
    return (
        <div className="grid grid-cols-4 gap-3">
            <StatTile label={t('home.tileQueue')} value={valueOrLoading(analysis.total)} icon={<Inbox size={15} />} />
            <StatTile
                label={t('home.tileStale', { days: staleDays })}
                value={valueOrLoading(analysis.stale.length)}
                icon={<Hourglass size={15} />}
                tone={analysis.stale.length ? 'warn' : undefined}
            />
            <StatTile
                label={t('home.tileOverdue')}
                value={valueOrLoading(analysis.overdue.length)}
                icon={<AlarmClock size={15} />}
                tone={analysis.overdue.length ? 'danger' : undefined}
            />
            <StatTile
                label={t('home.tileUnread')}
                value={unread}
                icon={<ArrowRight size={15} />}
                onClick={onGoNotifications}
            />
        </div>
    )
}

/** My queue, stalled issues and deadlines. */
export function QueuePanels() {
    const { t, error } = useI18n()
    const openIssue = useOpenIssue()
    const { mine, queue, analysis, staleDays, loaded } = useQueue()
    const today = new Date()
    const hiddenQueueCount = queue.length - QUEUE_PREVIEW_LIMIT

    const statusSummary = analysis.byStatus.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {analysis.byStatus.map(({ status, count }) => (
                <span key={status} className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">
                    {status} <b className="font-semibold text-fg">{count}</b>
                </span>
            ))}
        </div>
    )

    return (
        <>
            {mine.isError && <Alert>{error(mine.error)}</Alert>}
            <div className="grid grid-cols-2 gap-4">
                <Panel title={t('home.queue')} count={analysis.total} header={statusSummary}>
                    {queue.slice(0, QUEUE_PREVIEW_LIMIT).map((issue) => (
                        <IssueRow
                            key={issue.id}
                            issue={issue}
                            onOpen={openIssue}
                            right={<span className="truncate text-muted">{issue.status.name}</span>}
                        />
                    ))}
                    {hiddenQueueCount > 0 && (
                        <div className="px-4 py-2 text-xs text-muted">
                            {t('home.moreIssues', { count: hiddenQueueCount })}
                        </div>
                    )}
                    {loaded && !queue.length && <EmptyRow>{t('home.emptyQueue')}</EmptyRow>}
                </Panel>

                <div className="flex flex-col gap-4">
                    <Panel
                        title={t('home.stale')}
                        count={analysis.stale.length}
                        hint={t('home.staleHint', { days: staleDays })}
                    >
                        {analysis.stale.slice(0, SIDE_PANEL_LIMIT).map((issue) => (
                            <IssueRow
                                key={issue.id}
                                issue={issue}
                                onOpen={openIssue}
                                right={<StaleLabel issue={issue} today={today} />}
                            />
                        ))}
                        {loaded && !analysis.stale.length && <EmptyRow>{t('home.nothingStale')}</EmptyRow>}
                    </Panel>

                    <Panel title={t('home.deadlines')} count={analysis.dueSoon.length} hint={t('home.deadlinesHint')}>
                        {analysis.dueSoon.slice(0, SIDE_PANEL_LIMIT).map((issue) => (
                            <IssueRow
                                key={issue.id}
                                issue={issue}
                                onOpen={openIssue}
                                right={<DeadlineLabel issue={issue} today={today} />}
                            />
                        ))}
                        {loaded && !analysis.dueSoon.length && <EmptyRow>{t('home.noDeadlines')}</EmptyRow>}
                    </Panel>
                </div>
            </div>
        </>
    )
}

function StaleLabel({ issue, today }: { issue: Issue; today: Date }) {
    const { t } = useI18n()
    const blocked = isBlockedStatus(issue.status.name)
    const idleDays = t('duration.days', { count: daysSince(issue.updated_on, today) })
    return (
        <span className={cn('shrink-0', blocked ? 'text-warn' : 'text-muted')}>
            {blocked ? issue.status.name : idleDays}
        </span>
    )
}

function deadlineColor(daysLeft: number): string {
    if (daysLeft < 0) return 'font-medium text-danger'
    if (daysLeft <= DUE_SOON_WARN_DAYS) return 'text-warn'
    return 'text-muted'
}

function DeadlineLabel({ issue, today }: { issue: Issue; today: Date }) {
    const { dates } = useI18n()
    const dueDate = issue.due_date!
    const daysLeft = daysUntil(dueDate, today)
    return (
        <span className={cn('shrink-0', deadlineColor(daysLeft))}>
            {dates.date(issue.due_date)} · {dates.relativeDays(dueDate, today)}
        </span>
    )
}

export function LatestNotifications({
    items,
    onOpen,
    onSeeAll
}: {
    items: AppNotification[]
    onOpen: (notification: AppNotification) => void
    onSeeAll: () => void
}) {
    const { t } = useI18n()
    const unreadCount = items.filter((notification) => !notification.read).length
    return (
        <Panel
            title={t('home.latest')}
            count={unreadCount}
            action={
                <TextLink className="text-xs" onClick={onSeeAll}>
                    {t('home.seeAll')}
                </TextLink>
            }
        >
            <NotificationRows items={items.slice(0, LATEST_NOTIFICATIONS_LIMIT)} onOpen={onOpen} />
            {!items.length && <EmptyRow>{t('home.noNotifications')}</EmptyRow>}
        </Panel>
    )
}
