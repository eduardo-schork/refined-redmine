import { useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FLOATING_PANEL, useFloating } from '@/lib/floating'
import { IconButton, type IconButtonSize } from '../atoms/IconButton'

export type MenuEntry =
    | { label: string; icon?: ReactNode; checked?: boolean; onSelect: () => void }
    /** Replaces the menu with its own content (with a way back), instead of a side submenu. */
    | { label: string; icon?: ReactNode; submenu: (close: () => void) => ReactNode }
    | 'divider'

const ITEM = 'flex w-full cursor-default items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-panel-2'

/** One line of a menu; also used to build the content of a submenu. */
export function MenuItem({
    label,
    icon,
    checked,
    trailing,
    onClick
}: {
    label: string
    icon?: ReactNode
    checked?: boolean
    trailing?: ReactNode
    onClick: () => void
}) {
    return (
        <button type="button" role="menuitem" onClick={onClick} className={ITEM}>
            <span className="flex w-4 shrink-0 justify-center text-muted [&_svg]:size-[15px]">{icon}</span>
            <span className={cn('min-w-0 flex-1 truncate', checked && 'font-medium')}>{label}</span>
            {checked && <Check size={14} className="shrink-0 text-accent" />}
            {trailing}
        </button>
    )
}

// Clicks inside the menu must not reach what it sits on (a card opens the issue, a row is draggable).
const stopPropagation = (event: SyntheticEvent) => event.stopPropagation()

/** Icon button that opens a floating list of actions. */
export function Menu({
    label,
    entries,
    icon = <MoreVertical />,
    size = 'sm',
    className
}: {
    label: string
    entries: MenuEntry[]
    icon?: ReactNode
    size?: IconButtonSize
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const [submenu, setSubmenu] = useState<{ label: string; render: (close: () => void) => ReactNode }>()
    const close = () => {
        setOpen(false)
        setSubmenu(undefined)
    }
    const { rootRef, floatingRef, anchorStyle, floatingStyle } = useFloating(open, close, 'end')

    const select = (action: () => void) => {
        close()
        action()
    }
    // Esc closes only the menu, not the dialog around it.
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key !== 'Escape') return
        keyboardEvent.stopPropagation()
        close()
    }

    const renderEntry = (entry: MenuEntry, index: number) => {
        if (entry === 'divider') return <div key={`divider-${index}`} className="my-1 border-t border-line" />
        if ('submenu' in entry) {
            const openSubmenu = () => setSubmenu({ label: entry.label, render: entry.submenu })
            const arrow = <ChevronRight size={14} className="shrink-0 text-muted" />
            return (
                <MenuItem
                    key={entry.label}
                    label={entry.label}
                    icon={entry.icon}
                    trailing={arrow}
                    onClick={openSubmenu}
                />
            )
        }
        const choose = () => select(entry.onSelect)
        return (
            <MenuItem
                key={entry.label}
                label={entry.label}
                icon={entry.icon}
                checked={entry.checked}
                onClick={choose}
            />
        )
    }

    return (
        <div
            ref={rootRef}
            className={cn('shrink-0', className)}
            onKeyDown={handleKeyDown}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
        >
            <IconButton
                label={label}
                icon={icon}
                size={size}
                aria-haspopup="menu"
                aria-expanded={open}
                style={anchorStyle}
                onClick={() => (open ? close() : setOpen(true))}
            />
            {open && (
                <div
                    ref={floatingRef}
                    popover="manual"
                    role="menu"
                    style={floatingStyle}
                    className={cn(FLOATING_PANEL, 'min-w-56 max-w-xs py-1')}
                >
                    {submenu ? (
                        <>
                            <MenuItem
                                label={submenu.label}
                                icon={<ChevronLeft />}
                                onClick={() => setSubmenu(undefined)}
                            />
                            <div className="my-1 border-t border-line" />
                            <div className="max-h-80 overflow-y-auto">{submenu.render(close)}</div>
                        </>
                    ) : (
                        entries.map(renderEntry)
                    )}
                </div>
            )}
        </div>
    )
}
