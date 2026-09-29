import { AlarmClock, AtSign, Bell, FilePlus2, ListFilter, LogOut, MessageSquare, Shuffle, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppNotification, NotificationKind } from '@domain/notification/notification'
import { describeSources, formatNotification } from '@shared/i18n/format/notification'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const ICONS: Record<NotificationKind, ReactNode> = {
    new_issue: <FilePlus2 size={15} />,
    assigned: <UserPlus size={15} />,
    status: <Shuffle size={15} />,
    comment: <MessageSquare size={15} />,
    mention: <AtSign size={15} />,
    updated: <Bell size={15} />,
    unqueued: <LogOut size={15} />,
    query: <ListFilter size={15} />,
    reminder: <AlarmClock size={15} />
}

/** Full history (Notifications page). */
export function NotificationList({
    items,
    onOpen
}: {
    items: AppNotification[]
    onOpen: (notification: AppNotification) => void
}) {
    const now = new Date()
    return (
        <ul className="flex flex-col gap-1">
            {items.map((notification) => (
                <li key={notification.id}>
                    <NotificationCard notification={notification} now={now} onOpen={onOpen} />
                </li>
            ))}
        </ul>
    )
}

function NotificationCard({
    notification,
    now,
    onOpen
}: {
    notification: AppNotification
    now: Date
    onOpen: (notification: AppNotification) => void
}) {
    const { t, dates } = useI18n()
    const text = formatNotification(notification, t, dates, now)
    const [subject, ...extraLines] = text.body.split('\n')
    const via = describeSources(notification, t)
    const { read } = notification
    return (
        <button
            onClick={() => onOpen(notification)}
            className={cn(
                'flex w-full cursor-default items-start gap-3 rounded-lg border px-3 py-2.5 text-left',
                read ? 'border-transparent hover:bg-panel' : 'border-line bg-panel hover:border-muted/40'
            )}
        >
            <span className={cn('mt-0.5 shrink-0', read ? 'text-muted' : 'text-accent')}>
                {ICONS[notification.kind]}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                    <span className={cn('truncate text-[13px]', !read && 'font-semibold')}>{text.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted">
                        {dates.relativeTime(notification.createdAt, now)}
                    </span>
                </span>
                <span className="block truncate text-[13px]">{subject}</span>
                {extraLines.length > 0 && (
                    <span className="block whitespace-pre-line text-xs text-muted">{extraLines.join('\n')}</span>
                )}
                {via && <span className="block text-[11px] text-accent">{via}</span>}
            </span>
        </button>
    )
}

/** Compact summary (Home). */
export function NotificationRows({
    items,
    onOpen
}: {
    items: AppNotification[]
    onOpen: (notification: AppNotification) => void
}) {
    const now = new Date()
    return (
        <>
            {items.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} now={now} onOpen={onOpen} />
            ))}
        </>
    )
}

function NotificationRow({
    notification,
    now,
    onOpen
}: {
    notification: AppNotification
    now: Date
    onOpen: (notification: AppNotification) => void
}) {
    const { t, dates } = useI18n()
    const text = formatNotification(notification, t, dates, now)
    const detailLines = text.body.split('\n').slice(1)
    const detail = detailLines.join(' · ') || text.body
    const { read } = notification
    return (
        <button
            onClick={() => onOpen(notification)}
            className="flex w-full cursor-default items-center gap-3 border-t border-line px-4 py-2 text-left text-[13px] hover:bg-panel-2"
        >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', read ? 'bg-transparent' : 'bg-accent')} />
            <span className={cn('w-56 shrink-0 truncate', !read && 'font-medium')}>{text.title}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{detail}</span>
            <span className="shrink-0 text-xs text-muted">{dates.relativeTime(notification.createdAt, now)}</span>
        </button>
    )
}
