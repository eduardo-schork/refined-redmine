import {
    Bell,
    Clock,
    CalendarDays,
    Download,
    Flag,
    Home,
    KanbanSquare,
    Plus,
    ScrollText,
    Search,
    SquarePen,
    Settings as SettingsIcon
} from 'lucide-react'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import { displayName } from '@domain/redmine/entities'
import { unreadCount, useMonitorStatus, useNotifications } from '@/hooks/notifications'
import { useUpdateStatus } from '@/hooks/updates'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import type { Route } from '@/lib/router'
import { NEW_ISSUE_SHORTCUT, SEARCH_SHORTCUT } from '@/lib/shortcuts'
import { Avatar } from '../atoms/Avatar'
import { Badge } from '../atoms/Badge'
import { Kbd } from '../atoms/Kbd'
import { Overline, StatusDot } from '../atoms/misc'
import { NavItem } from '../molecules/NavItem'
import { useNewIssue } from './IssueModal'
import { TimerWidget } from './time/TimerWidget'

export function Sidebar({
    route,
    onNavigate,
    onNewBoard,
    onSearch
}: {
    route: Route
    onNavigate: (route: Route) => void
    onNewBoard: () => void
    onSearch: () => void
}) {
    const { t } = useI18n()
    const openNewIssue = useNewIssue()
    const settings = useSettings()
    const unread = unreadCount(useNotifications().data)
    const status = useMonitorStatus().data
    const boards = settings.boards
    const activeBoardId = route.page === 'board' ? (route.boardId ?? boards[0]?.id) : undefined
    const isActive = (page: Route['page']) => route.page === page

    return (
        <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
            <div className="drag h-12 shrink-0" />
            <div className="mx-2 mb-2 flex gap-1.5">
                <button
                    onClick={onSearch}
                    className="flex h-8 min-w-0 flex-1 cursor-default items-center gap-2 rounded-md border border-line px-2 text-sm text-muted hover:text-fg"
                >
                    <Search size={14} />
                    <span className="flex-1 text-left">{t('search.button')}</span>
                    <Kbd>{SEARCH_SHORTCUT}</Kbd>
                </button>
                <button
                    onClick={() => openNewIssue()}
                    title={`${t('issue.create.title')} (${NEW_ISSUE_SHORTCUT})`}
                    aria-label={t('issue.create.title')}
                    className="flex h-8 w-8 shrink-0 cursor-default items-center justify-center rounded-md border border-line text-muted hover:text-fg"
                >
                    <SquarePen size={15} />
                </button>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
                <NavItem
                    active={isActive('home')}
                    onClick={() => onNavigate({ page: 'home' })}
                    icon={<Home size={15} />}
                >
                    {t('nav.home')}
                </NavItem>
                <NavItem
                    active={isActive('calendar')}
                    onClick={() => onNavigate({ page: 'calendar' })}
                    icon={<CalendarDays size={15} />}
                >
                    {t('nav.calendar')}
                </NavItem>
                <NavItem
                    active={isActive('sprints')}
                    onClick={() => onNavigate({ page: 'sprints' })}
                    icon={<Flag size={15} />}
                >
                    {t('nav.sprints')}
                </NavItem>
                <NavItem
                    active={isActive('time')}
                    onClick={() => onNavigate({ page: 'time' })}
                    icon={<Clock size={15} />}
                >
                    {t('nav.time')}
                </NavItem>

                <div className="flex items-center justify-between px-2 pb-1 pt-4">
                    <Overline>{t('nav.boards')}</Overline>
                    <button
                        className="rounded p-0.5 text-muted hover:bg-panel-2 hover:text-fg"
                        onClick={onNewBoard}
                        title={t('nav.newBoard')}
                    >
                        <Plus size={14} />
                    </button>
                </div>
                {boards.map((board) => (
                    <NavItem
                        key={board.id}
                        active={activeBoardId === board.id}
                        onClick={() => onNavigate({ page: 'board', boardId: board.id })}
                        icon={<KanbanSquare size={15} />}
                    >
                        {board.name}
                    </NavItem>
                ))}
                {boards.length === 0 && (
                    <button
                        onClick={onNewBoard}
                        className="mx-2 rounded-md border border-dashed border-line px-2 py-2 text-left text-xs text-muted hover:text-fg"
                    >
                        {t('nav.firstBoard')}
                    </button>
                )}

                <Overline className="mt-4 px-2 pb-1">{t('nav.app')}</Overline>
                <NavItem
                    active={isActive('notifications')}
                    onClick={() => onNavigate({ page: 'notifications' })}
                    icon={<Bell size={15} />}
                >
                    <span className="flex-1">{t('nav.notifications')}</span>
                    {unread > 0 && (
                        <Badge tone="accent" className="rounded-full">
                            {unread}
                        </Badge>
                    )}
                </NavItem>
                <NavItem
                    active={isActive('log')}
                    onClick={() => onNavigate({ page: 'log' })}
                    icon={<ScrollText size={15} />}
                >
                    {t('nav.log')}
                </NavItem>
                <NavItem
                    active={isActive('settings')}
                    onClick={() => onNavigate({ page: 'settings' })}
                    icon={<SettingsIcon size={15} />}
                >
                    {t('nav.settings')}
                </NavItem>
            </nav>
            <TimerWidget />
            <UpdateNotice onOpen={() => onNavigate({ page: 'settings', tab: 'general' })} />
            {settings.user && (
                <footer className="flex items-center gap-2 border-t border-line px-3 py-2.5">
                    <Avatar name={displayName(settings.user)} className="h-6 w-6 text-2xs" />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{displayName(settings.user)}</div>
                        <MonitorIndicator status={status} />
                    </div>
                </footer>
            )}
        </aside>
    )
}

type MonitorTone = 'ok' | 'muted' | 'danger'

function describeMonitor(
    status: MonitorStatus,
    { t, dates }: Pick<ReturnType<typeof useI18n>, 't' | 'dates'>
): { tone: MonitorTone; text: string } {
    if (status.lastError) return { tone: 'danger', text: t('monitor.error') }
    if (status.paused === 'schedule') return { tone: 'muted', text: t('monitor.outOfHours') }
    if (status.running) return { tone: 'ok', text: t('monitor.checking') }
    if (!status.lastCheckAt) return { tone: 'ok', text: t('monitor.active') }
    const lastCheckTime = dates.time(new Date(status.lastCheckAt))
    return { tone: 'ok', text: t('monitor.checkedAt', { time: lastCheckTime }) }
}

function MonitorIndicator({ status }: { status?: MonitorStatus }) {
    const { t, dates, error } = useI18n()
    if (!status) return null
    const { tone, text } = describeMonitor(status, { t, dates })
    const errorTooltip = status.lastError ? error(status.lastError) : undefined
    return (
        <div className="flex items-center gap-1.5 text-2xs text-muted" title={errorTooltip}>
            <StatusDot tone={tone} />
            <span className="truncate">{text}</span>
        </div>
    )
}

/** Shown while a newer version is available or downloaded. */
function UpdateNotice({ onOpen }: { onOpen: () => void }) {
    const { t } = useI18n()
    const status = useUpdateStatus().data
    const version = status?.latest?.version
    const visible = version && (status.phase === 'available' || status.phase === 'ready')
    if (!visible) return null
    return (
        <button
            onClick={onOpen}
            className="mx-3 mb-2 flex cursor-default items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-left text-sm text-accent hover:brightness-105"
        >
            <Download size={14} />
            {t('updates.sidebar', { version })}
        </button>
    )
}
