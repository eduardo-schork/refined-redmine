import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { groupByDay } from '@domain/notification/inbox'
import type { AppNotification } from '@domain/notification/notification'
import { daysUntil, parseLocal, type LocalDate } from '@domain/shared/date'
import { formatNotification } from '@shared/i18n/format/notification'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Kbd } from '../atoms/Kbd'
import { Overline } from '../atoms/misc'
import { NotificationItem, type NotificationActions } from './NotificationItem'

const STEP_KEYS: Record<string, number> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }

const ITEM_KEYS: Record<string, keyof NotificationActions> = {
    Enter: 'open',
    e: 'toggleRead',
    Delete: 'remove',
    Backspace: 'remove'
}

function dayLabel(date: LocalDate, now: Date, { t, dates }: Pick<ReturnType<typeof useI18n>, 't' | 'dates'>): string {
    const offset = daysUntil(date, now)
    if (offset === 0) return t('notificationsPage.today')
    if (offset === -1) return t('notificationsPage.yesterday')
    const day = parseLocal(date)
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
    if (day.getFullYear() !== now.getFullYear()) options.year = 'numeric'
    return dates.format(day, options)
}

/** After removing the selected row, the selection goes to the next one (or the previous one at the end). */
function neighborOf(ordered: AppNotification[], id: string): string | undefined {
    const index = ordered.findIndex((notification) => notification.id === id)
    const neighbor = ordered[index + 1] ?? ordered[index - 1]
    return neighbor?.id
}

function useKeyboardSelection(ordered: AppNotification[], actions: NotificationActions) {
    const [activeId, setActiveId] = useState<string>()
    const listRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const active = listRef.current?.querySelector('[data-active="true"]')
        active?.scrollIntoView({ block: 'nearest' })
    }, [activeId])

    const moveBy = (step: number) => {
        if (!ordered.length) return
        const index = ordered.findIndex((notification) => notification.id === activeId)
        const start = index < 0 && step < 0 ? ordered.length : index
        const nextIndex = Math.min(ordered.length - 1, Math.max(0, start + step))
        setActiveId(ordered[nextIndex].id)
    }

    const runOnActive = (action: keyof NotificationActions) => {
        const active = ordered.find((notification) => notification.id === activeId)
        if (!active) return
        if (action === 'remove') setActiveId(neighborOf(ordered, active.id))
        actions[action](active)
    }

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey) return
        // The hover buttons (read, remove, Redmine) keep their own Enter.
        const onRowAction = (keyboardEvent.target as HTMLElement).closest('[data-row-actions]')
        if (onRowAction) return
        const step = STEP_KEYS[keyboardEvent.key]
        const action = ITEM_KEYS[keyboardEvent.key]
        if (!step && !action) return
        keyboardEvent.preventDefault()
        if (step) {
            moveBy(step)
            return
        }
        runOnActive(action)
    }

    return { activeId, setActiveId, listRef, handleKeyDown }
}

/** Full history (Notifications page), grouped by day, with keyboard navigation. */
export function NotificationList({
    items,
    now,
    actions
}: {
    items: AppNotification[]
    now: Date
    actions: NotificationActions
}) {
    const { t, dates } = useI18n()
    const days = groupByDay(items)
    const ordered = days.flatMap((day) => day.items)
    const { activeId, setActiveId, listRef, handleKeyDown } = useKeyboardSelection(ordered, actions)
    return (
        <div
            ref={listRef}
            role="listbox"
            aria-label={t('nav.notifications')}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="flex flex-col gap-3 rounded-lg outline-none"
        >
            {days.map((day) => (
                <section key={day.date}>
                    <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-bg/95 px-2 py-1.5 backdrop-blur">
                        <Overline>{dayLabel(day.date, now, { t, dates })}</Overline>
                        <span className="text-2xs tabular-nums text-muted">{day.items.length}</span>
                    </div>
                    <ul className="flex flex-col">
                        {day.items.map((notification) => (
                            <li key={notification.id} role="option" aria-selected={notification.id === activeId}>
                                <NotificationItem
                                    notification={notification}
                                    now={now}
                                    active={notification.id === activeId}
                                    actions={actions}
                                    onFocus={() => setActiveId(notification.id)}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
            <KeyboardHint />
        </div>
    )
}

function KeyboardHint() {
    const { t } = useI18n()
    const hints = [
        { keys: ['↑', '↓'], label: t('notificationsPage.keys.move') },
        { keys: ['↵'], label: t('notificationsPage.keys.open') },
        { keys: ['E'], label: t('notificationsPage.keys.read') },
        { keys: ['⌫'], label: t('notificationsPage.keys.remove') }
    ]
    return (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 py-2 text-2xs text-muted">
            {hints.map((hint) => (
                <span key={hint.label} className="inline-flex items-center gap-1">
                    {hint.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                    ))}
                    {hint.label}
                </span>
            ))}
        </div>
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
            className="flex w-full cursor-default items-center gap-3 border-t border-line px-4 py-2 text-left text-sm hover:bg-panel-2"
        >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', read ? 'bg-transparent' : 'bg-accent')} />
            <span className={cn('w-56 shrink-0 truncate', !read && 'font-medium')}>{text.title}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{detail}</span>
            <span className="shrink-0 text-xs text-muted">{dates.relativeTime(notification.createdAt, now)}</span>
        </button>
    )
}
