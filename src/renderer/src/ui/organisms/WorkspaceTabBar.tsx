import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type WheelEvent } from 'react'
import {
    Bell,
    CalendarDays,
    Clock,
    Flag,
    Home,
    Landmark,
    KanbanSquare,
    ScrollText,
    Settings as SettingsIcon,
    Users,
    X,
    type LucideIcon
} from 'lucide-react'
import { useSettings } from '@/hooks/session'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import type { Route } from '@/lib/router'
import type { WorkspaceTab } from '@/lib/workspace-tabs'

const PAGE_ICONS: Record<Route['page'], LucideIcon> = {
    home: Home,
    calendar: CalendarDays,
    sprints: Flag,
    time: Clock,
    overtime: Landmark,
    team: Users,
    board: KanbanSquare,
    notifications: Bell,
    log: ScrollText,
    settings: SettingsIcon
}

const MIDDLE_BUTTON = 1

export interface TabActions {
    select: (key: string) => void
    close: (key: string) => void
    closeOthers: (key: string) => void
    duplicate: (key: string) => void
    move: (fromKey: string, toKey: string) => void
}

interface MenuPosition {
    key: string
    left: number
    top: number
}

/**
 * The open screens as tabs, like a browser: a click brings one to the front, the × or a middle click closes it,
 * dragging reorders them and the right click offers "Duplicate" and "Close the others". The bar doubles as the
 * window's title bar on macOS (draggable between tabs).
 */
export function WorkspaceTabBar({
    tabs,
    activeKey,
    actions
}: {
    tabs: WorkspaceTab[]
    activeKey?: string
    actions: TabActions
}) {
    const { t } = useI18n()
    const boards = useSettings().boards
    const scroller = useRef<HTMLDivElement>(null)
    const dragged = useRef<string | undefined>(undefined)
    const [menu, setMenu] = useState<MenuPosition>()

    useEffect(() => {
        const activeTab = scroller.current?.querySelector('[aria-selected="true"]')
        activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }, [activeKey, tabs.length])

    const labelOf = (route: Route) => {
        if (route.page === 'board') return boards.find((board) => board.id === route.boardId)?.name ?? t('nav.boards')
        return t(`nav.${route.page}`)
    }
    // A vertical mouse wheel scrolls the tabs sideways.
    const scrollSideways = (event: WheelEvent<HTMLDivElement>) => {
        if (scroller.current) scroller.current.scrollLeft += event.deltaY
    }
    const dropOn = (key: string) => {
        if (dragged.current) actions.move(dragged.current, key)
        dragged.current = undefined
    }

    return (
        <div className="drag flex h-10 shrink-0 items-end border-b border-line bg-panel px-2">
            <div
                ref={scroller}
                role="tablist"
                aria-label={t('workspace.tabs')}
                onWheel={scrollSideways}
                className="no-scrollbar flex min-w-0 items-end gap-0.5 overflow-x-auto"
            >
                {tabs.map((tab) => (
                    <TabButton
                        key={tab.key}
                        label={labelOf(tab.route)}
                        Icon={PAGE_ICONS[tab.route.page]}
                        active={tab.key === activeKey}
                        closeLabel={t('workspace.closeTab', { name: labelOf(tab.route) })}
                        onSelect={() => actions.select(tab.key)}
                        onClose={() => actions.close(tab.key)}
                        onMenu={(left, top) => setMenu({ key: tab.key, left, top })}
                        onDragStart={() => (dragged.current = tab.key)}
                        onDrop={() => dropOn(tab.key)}
                    />
                ))}
            </div>
            {menu && <TabMenu position={menu} actions={actions} onClose={() => setMenu(undefined)} />}
        </div>
    )
}

function TabMenu({ position, actions, onClose }: { position: MenuPosition; actions: TabActions; onClose: () => void }) {
    const { t } = useI18n()
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [onClose])
    const items: [string, (key: string) => void][] = [
        [t('workspace.duplicate'), actions.duplicate],
        [t('workspace.close'), actions.close],
        [t('workspace.closeOthers'), actions.closeOthers]
    ]
    return (
        <div className="no-drag fixed inset-0 z-50" onClick={onClose} onContextMenu={(event) => event.preventDefault()}>
            <div
                role="menu"
                style={{ left: position.left, top: position.top }}
                className="absolute flex min-w-44 flex-col rounded-md border border-line bg-panel py-1 text-sm shadow-lg"
            >
                {items.map(([label, run]) => (
                    <button
                        key={label}
                        role="menuitem"
                        className="cursor-default px-3 py-1.5 text-left hover:bg-panel-2"
                        onClick={() => run(position.key)}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function TabButton({
    label,
    Icon,
    active,
    closeLabel,
    onSelect,
    onClose,
    onMenu,
    onDragStart,
    onDrop
}: {
    label: string
    Icon: LucideIcon
    active: boolean
    closeLabel: string
    onSelect: () => void
    onClose: () => void
    onMenu: (left: number, top: number) => void
    onDragStart: () => void
    onDrop: () => void
}) {
    const closeOnMiddleClick = (event: MouseEvent) => {
        if (event.button !== MIDDLE_BUTTON) return
        event.preventDefault()
        onClose()
    }
    const closeOnly = (event: MouseEvent) => {
        event.stopPropagation()
        onClose()
    }
    const openMenu = (event: MouseEvent) => {
        event.preventDefault()
        onMenu(event.clientX, event.clientY)
    }
    const allowDrop = (event: DragEvent) => event.preventDefault()
    return (
        <div
            role="tab"
            aria-selected={active}
            title={label}
            draggable
            onClick={onSelect}
            onAuxClick={closeOnMiddleClick}
            onContextMenu={openMenu}
            onDragStart={onDragStart}
            onDragOver={allowDrop}
            onDrop={onDrop}
            className={cn(
                'no-drag group -mb-px flex h-8 max-w-52 shrink-0 cursor-default items-center gap-1.5 rounded-t-md border border-b-0 pl-2.5 pr-1 text-sm',
                active
                    ? 'border-line bg-bg font-medium text-fg'
                    : 'border-transparent text-muted hover:bg-panel-2 hover:text-fg'
            )}
        >
            <Icon size={14} className="shrink-0" />
            <span className="truncate">{label}</span>
            <button
                type="button"
                aria-label={closeLabel}
                onClick={closeOnly}
                className={cn(
                    'ml-0.5 rounded p-0.5 text-muted hover:bg-panel-2 hover:text-fg',
                    active ? 'visible' : 'invisible group-hover:visible'
                )}
            >
                <X size={13} />
            </button>
        </div>
    )
}
