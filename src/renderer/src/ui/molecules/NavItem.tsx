import type { MouseEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const MIDDLE_BUTTON = 1

/** `onClick(true)` for ⌘/Ctrl-click or a middle click: open it in a new tab. */
export function NavItem({
    active,
    onClick,
    icon,
    children
}: {
    active: boolean
    onClick: (inNewTab: boolean) => void
    icon: ReactNode
    children: ReactNode
}) {
    const openOnMiddleClick = (event: MouseEvent) => {
        if (event.button !== MIDDLE_BUTTON) return
        event.preventDefault()
        onClick(true)
    }
    return (
        <button
            onClick={(event) => onClick(event.metaKey || event.ctrlKey)}
            onAuxClick={openOnMiddleClick}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-left text-sm',
                active ? 'bg-panel-2 font-medium text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg'
            )}
        >
            <span className="shrink-0">{icon}</span>
            <span className="flex min-w-0 flex-1 items-center truncate">{children}</span>
        </button>
    )
}
