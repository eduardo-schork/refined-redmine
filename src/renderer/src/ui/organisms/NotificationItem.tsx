import {
    AlarmClock,
    AtSign,
    Bell,
    ExternalLink,
    FilePlus2,
    ListFilter,
    LogOut,
    Mail,
    MailOpen,
    MessageSquare,
    Shuffle,
    UserPlus,
    X
} from 'lucide-react'
import type { ReactNode } from 'react'
import type {
    AppNotification,
    IssueChange,
    IssueRef,
    NotificationKind,
    NotificationPayload
} from '@domain/notification/notification'
import type { IssueStatus } from '@domain/redmine/entities'
import {
    describeChange,
    describeExitReason,
    describeSources,
    formatNotification
} from '@shared/i18n/format/notification'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { IconButton } from '../atoms/IconButton'
import { StatusTag } from '../molecules/StatusTag'

const ICONS: Record<NotificationKind, ReactNode> = {
    new_issue: <FilePlus2 size={14} />,
    assigned: <UserPlus size={14} />,
    status: <Shuffle size={14} />,
    comment: <MessageSquare size={14} />,
    mention: <AtSign size={14} />,
    updated: <Bell size={14} />,
    unqueued: <LogOut size={14} />,
    query: <ListFilter size={14} />,
    reminder: <AlarmClock size={14} />
}

const KIND_TONES: Record<NotificationKind, string> = {
    new_issue: 'bg-ok/15 text-ok',
    assigned: 'bg-ok/15 text-ok',
    status: 'bg-st-progress/15 text-st-progress',
    comment: 'bg-st-review/15 text-st-review',
    mention: 'bg-accent-soft text-accent',
    updated: 'bg-panel-2 text-muted',
    unqueued: 'bg-warn/15 text-warn',
    query: 'bg-st-testing/15 text-st-testing',
    reminder: 'bg-st-new/15 text-fg/85'
}

export interface NotificationActions {
    open: (notification: AppNotification) => void
    toggleRead: (notification: AppNotification) => void
    remove: (notification: AppNotification) => void
    openInRedmine: (notification: AppNotification) => void
}

const SEPARATOR = ' · '

function issueOf(payload: NotificationPayload): IssueRef | undefined {
    switch (payload.type) {
        case 'issueCreated':
        case 'issueChanged':
        case 'queueExit':
            return payload.issue
        default:
            return undefined
    }
}

/** Only the name is known: the color comes from the name (statuses recolored by id keep the automatic tone). */
const statusNamed = (name: string): IssueStatus => ({ id: 0, name, is_closed: false })

function ChangePiece({ change }: { change: IssueChange }) {
    const { t } = useI18n()
    switch (change.type) {
        case 'statusChanged':
            return (
                <span className="inline-flex items-center gap-1">
                    <StatusTag status={statusNamed(change.from)} />→<StatusTag status={statusNamed(change.to)} />
                </span>
            )
        case 'commented':
            return <span>{t('notificationsPage.commented')}</span>
        case 'mentioned':
            return <span>{t('notificationsPage.mentioned')}</span>
        default:
            return <span>{describeChange(change, t)}</span>
    }
}

function Quote({ text }: { text: string }) {
    return <span className="mt-1 line-clamp-2 block border-l-2 border-line pl-2 text-xs italic text-fg/80">{text}</span>
}

function excerptOf(change: IssueChange): string | undefined {
    if (change.type === 'commented' || change.type === 'mentioned') return change.excerpt
    return undefined
}

function ActorLine({ actor, children }: { actor: string; children?: ReactNode }) {
    return (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            <span className="font-medium text-fg/85">{actor}</span>
            {children}
        </span>
    )
}

function ChangesDetail({ actor, changes }: { actor: string; changes: IssueChange[] }) {
    const excerpts = changes.map(excerptOf).filter((excerpt): excerpt is string => Boolean(excerpt))
    return (
        <>
            <ActorLine actor={actor}>
                {changes.map((change, index) => (
                    <span key={index} className="inline-flex items-center gap-1.5">
                        {index > 0 && <span aria-hidden>·</span>}
                        <ChangePiece change={change} />
                    </span>
                ))}
            </ActorLine>
            {excerpts.map((excerpt, index) => (
                <Quote key={index} text={excerpt} />
            ))}
        </>
    )
}

function NotificationDetail({ notification, fallback }: { notification: AppNotification; fallback: string[] }) {
    const { t } = useI18n()
    const payload = notification.payload
    switch (payload.type) {
        case 'issueChanged':
            return <ChangesDetail actor={payload.actor} changes={payload.changes} />
        case 'issueCreated':
            return <ActorLine actor={payload.actor} />
        case 'queueExit': {
            const reasons = payload.reasons.map((reason) => describeExitReason(reason, t)).join(SEPARATOR)
            return (
                <>
                    <ActorLine actor={payload.actor ?? t('common.someone')}>
                        <span>{reasons}</span>
                    </ActorLine>
                    {payload.excerpt && <Quote text={payload.excerpt} />}
                </>
            )
        }
        default:
            if (fallback.length === 0) return null
            return <span className="block whitespace-pre-line text-xs text-muted">{fallback.join('\n')}</span>
    }
}

function RowActions({ notification, actions }: { notification: AppNotification; actions: NotificationActions }) {
    const { t } = useI18n()
    const readLabel = notification.read ? t('notificationsPage.markUnread') : t('notificationsPage.markRead')
    const readIcon = notification.read ? <Mail size={14} /> : <MailOpen size={14} />
    return (
        <div
            data-row-actions
            className="absolute right-2 top-1.5 hidden items-center gap-0.5 rounded-md border border-line bg-panel p-0.5 shadow-sm group-hover:flex group-data-[active=true]:flex"
        >
            <IconButton size="sm" label={readLabel} icon={readIcon} onClick={() => actions.toggleRead(notification)} />
            {notification.issueId && (
                <IconButton
                    size="sm"
                    label={t('common.openInRedmine')}
                    icon={<ExternalLink size={14} />}
                    onClick={() => actions.openInRedmine(notification)}
                />
            )}
            <IconButton
                size="sm"
                tone="danger"
                label={t('notificationsPage.remove')}
                icon={<X size={14} />}
                onClick={() => actions.remove(notification)}
            />
        </div>
    )
}

/** One row of the Notifications page: kind, issue, who did what, when; actions on hover or when selected. */
export function NotificationItem({
    notification,
    now,
    active,
    actions,
    onFocus
}: {
    notification: AppNotification
    now: Date
    active: boolean
    actions: NotificationActions
    onFocus: () => void
}) {
    const { t, dates } = useI18n()
    const text = formatNotification(notification, t, dates, now)
    const [subject, ...extraLines] = text.body.split('\n')
    const via = describeSources(notification, t)
    const issue = issueOf(notification.payload)
    const issueMeta = [issue?.tracker, issue?.project].filter(Boolean).join(SEPARATOR)
    const unread = !notification.read
    return (
        <div data-active={active} className={cn('group relative rounded-lg', active ? 'bg-panel-2' : 'hover:bg-panel')}>
            <button
                onClick={() => actions.open(notification)}
                onFocus={onFocus}
                className="flex w-full cursor-default items-start gap-2.5 px-2 py-2 text-left outline-none"
            >
                <span
                    className={cn('mt-3 h-1.5 w-1.5 shrink-0 rounded-full', unread ? 'bg-accent' : 'bg-transparent')}
                />
                <span
                    className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        KIND_TONES[notification.kind]
                    )}
                >
                    {ICONS[notification.kind]}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                        <span className={cn('truncate text-sm', unread ? 'font-semibold' : 'text-fg/85')}>
                            {text.title}
                        </span>
                        {issueMeta && <span className="truncate text-2xs text-muted">{issueMeta}</span>}
                        <time
                            dateTime={notification.createdAt}
                            title={dates.dateTime(notification.createdAt)}
                            className="ml-auto shrink-0 text-2xs text-muted"
                        >
                            {dates.relativeTime(notification.createdAt, now)}
                        </time>
                    </span>
                    <span className={cn('block truncate text-sm', !unread && 'text-muted')}>{subject}</span>
                    <NotificationDetail notification={notification} fallback={extraLines} />
                    {via && <span className="mt-0.5 block text-2xs text-accent">{via}</span>}
                </span>
            </button>
            <RowActions notification={notification} actions={actions} />
        </div>
    )
}
