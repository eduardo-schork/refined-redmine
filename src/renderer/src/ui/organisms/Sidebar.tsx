import {
    Bell,
    BellRing,
    Clock,
    CalendarDays,
    Download,
    Flag,
    Home,
    KanbanSquare,
    Landmark,
    Plus,
    ScrollText,
    Search,
    SquarePen,
    Settings as SettingsIcon,
    Users
} from 'lucide-react'
import { useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import type { Board } from '@domain/board/board'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import { displayName } from '@domain/redmine/entities'
import { useBoardCount } from '@/hooks/boards'
import { unreadCount, useMonitorStatus, useNotifications } from '@/hooks/notifications'
import { useUpdateStatus } from '@/hooks/updates'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import type { NavigateOptions, Route } from '@/lib/router'
import { moveItem } from '@/lib/move-item'
import { NEW_ISSUE_SHORTCUT, SEARCH_SHORTCUT } from '@/lib/shortcuts'
import {
    clampSidebarWidth,
    loadSidebarWidth,
    saveSidebarWidth,
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_MAX_WIDTH,
    SIDEBAR_MIN_WIDTH
} from '@/lib/sidebar-width'
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
    /** The screen in front; undefined when every tab was closed. */
    route?: Route
    onNavigate: (route: Route, options?: NavigateOptions) => void
    onNewBoard: () => void
    onSearch: () => void
}) {
    const { t } = useI18n()
    const openNewIssue = useNewIssue()
    const settings = useSettings()
    const unread = unreadCount(useNotifications().data)
    const status = useMonitorStatus().data
    const boards = settings.boards
    const activeBoardId = route?.page === 'board' ? (route.boardId ?? boards[0]?.id) : undefined
    const isActive = (page: Route['page']) => route?.page === page
    const sidebarWidth = useSidebarWidth()

    return (
        <aside
            className="relative flex shrink-0 flex-col border-r border-line bg-panel"
            style={{ width: sidebarWidth.width }}
        >
            <ResizeHandle sidebar={sidebarWidth} />
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
                    onClick={(newTab) => onNavigate({ page: 'home' }, { newTab })}
                    icon={<Home size={15} />}
                >
                    {t('nav.home')}
                </NavItem>
                <NavItem
                    active={isActive('calendar')}
                    onClick={(newTab) => onNavigate({ page: 'calendar' }, { newTab })}
                    icon={<CalendarDays size={15} />}
                >
                    {t('nav.calendar')}
                </NavItem>
                <NavItem
                    active={isActive('sprints')}
                    onClick={(newTab) => onNavigate({ page: 'sprints' }, { newTab })}
                    icon={<Flag size={15} />}
                >
                    {t('nav.sprints')}
                </NavItem>
                <NavItem
                    active={isActive('time')}
                    onClick={(newTab) => onNavigate({ page: 'time' }, { newTab })}
                    icon={<Clock size={15} />}
                >
                    {t('nav.time')}
                </NavItem>
                <NavItem
                    active={isActive('overtime')}
                    onClick={(newTab) => onNavigate({ page: 'overtime' }, { newTab })}
                    icon={<Landmark size={15} />}
                >
                    {t('nav.overtime')}
                </NavItem>
                <NavItem
                    active={isActive('team')}
                    onClick={(newTab) => onNavigate({ page: 'team' }, { newTab })}
                    icon={<Users size={15} />}
                >
                    {t('nav.team')}
                </NavItem>

                <NavItem
                    active={isActive('monitors')}
                    onClick={(newTab) => onNavigate({ page: 'monitors' }, { newTab })}
                    icon={<BellRing size={15} />}
                >
                    {t('nav.monitors')}
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
                <BoardNavList boards={boards} activeBoardId={activeBoardId} onNavigate={onNavigate} />
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
                    onClick={(newTab) => onNavigate({ page: 'notifications' }, { newTab })}
                    icon={<Bell size={15} />}
                >
                    <span className="flex-1">{t('nav.notifications')}</span>
                    {unread > 0 && (
                        <Badge tone="accent" className="rounded-full">
                            {unread}
                        </Badge>
                    )}
                </NavItem>
                {settings.showLog && (
                    <NavItem
                        active={isActive('log')}
                        onClick={(newTab) => onNavigate({ page: 'log' }, { newTab })}
                        icon={<ScrollText size={15} />}
                    >
                        {t('nav.log')}
                    </NavItem>
                )}
                <NavItem
                    active={isActive('settings')}
                    onClick={(newTab) => onNavigate({ page: 'settings' }, { newTab })}
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

/** The boards, in the order the user dragged them into. */
function BoardNavList({
    boards,
    activeBoardId,
    onNavigate
}: {
    boards: Board[]
    activeBoardId?: string
    onNavigate: (route: Route, options?: NavigateOptions) => void
}) {
    const updateSettings = useUpdateSettings()
    const draggedIndex = useRef<number | undefined>(undefined)

    const allowDrop = (event: DragEvent) => event.preventDefault()
    const dropOn = (targetIndex: number) => {
        const fromIndex = draggedIndex.current
        draggedIndex.current = undefined
        if (fromIndex === undefined || fromIndex === targetIndex) return
        updateSettings.mutate({ boards: moveItem(boards, fromIndex, targetIndex - fromIndex) })
    }

    return boards.map((board, index) => (
        <div
            key={board.id}
            draggable
            onDragStart={() => (draggedIndex.current = index)}
            onDragOver={allowDrop}
            onDrop={() => dropOn(index)}
            className="flex flex-col"
        >
            <NavItem
                active={activeBoardId === board.id}
                onClick={(newTab) => onNavigate({ page: 'board', boardId: board.id }, { newTab })}
                icon={<KanbanSquare size={15} />}
                title={board.name}
            >
                <span className="min-w-0 flex-1 truncate">{board.name}</span>
                <BoardCountBadge boardId={board.id} />
            </NavItem>
        </div>
    ))
}

/** How many issues the board has, at a glance (like the redmine-adapter); "!" when its query fails. */
function BoardCountBadge({ boardId }: { boardId: string }) {
    const { t, error } = useI18n()
    const count = useBoardCount(boardId)
    if (count.isError) {
        return (
            <Badge tone="outline" className="font-semibold text-danger" title={error(count.error)}>
                !
            </Badge>
        )
    }
    if (count.data === undefined || count.data === null) return null
    return (
        <Badge tone="outline" className="tabular-nums" title={t('nav.boardCount', { count: count.data })}>
            {count.data}
        </Badge>
    )
}

/** The width follows the pointer while dragging and is saved when the drag ends. */
function useSidebarWidth() {
    const [width, setWidth] = useState(loadSidebarWidth)
    const resize = (next: number) => setWidth(clampSidebarWidth(next))
    const commit = (next: number) => {
        const clamped = clampSidebarWidth(next)
        setWidth(clamped)
        saveSidebarWidth(clamped)
    }
    return { width, resize, commit }
}

const KEYBOARD_STEPS: Record<string, number> = { ArrowLeft: -16, ArrowRight: 16 }

/**
 * The sidebar's right edge: drag it to widen the sidebar (within limits), double-click for the default width, or
 * focus it and use the arrows. `no-drag`: the window's drag region at the top would swallow the pointer.
 */
function ResizeHandle({ sidebar }: { sidebar: ReturnType<typeof useSidebarWidth> }) {
    const { t } = useI18n()
    const dragStart = useRef<{ x: number; width: number } | undefined>(undefined)
    const widthAt = (event: PointerEvent) => {
        const start = dragStart.current
        return start ? start.width + event.clientX - start.x : sidebar.width
    }
    const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragStart.current = { x: event.clientX, width: sidebar.width }
    }
    const drag = (event: PointerEvent) => {
        if (dragStart.current) sidebar.resize(widthAt(event))
    }
    const endDrag = (event: PointerEvent) => {
        if (!dragStart.current) return
        sidebar.commit(widthAt(event))
        dragStart.current = undefined
    }
    const handleKeyDown = (event: KeyboardEvent) => {
        const step = KEYBOARD_STEPS[event.key]
        if (!step) return
        event.preventDefault()
        sidebar.commit(sidebar.width + step)
    }
    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('nav.resize')}
            aria-valuenow={sidebar.width}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            tabIndex={0}
            title={t('nav.resizeHint')}
            onPointerDown={beginDrag}
            onPointerMove={drag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => sidebar.commit(SIDEBAR_DEFAULT_WIDTH)}
            onKeyDown={handleKeyDown}
            className="no-drag absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize outline-none after:absolute after:inset-y-0 after:left-[3px] after:w-0.5 hover:after:bg-accent/60 focus-visible:after:bg-accent active:after:bg-accent"
        />
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
