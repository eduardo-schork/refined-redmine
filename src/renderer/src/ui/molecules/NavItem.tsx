import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function NavItem({
    active,
    onClick,
    icon,
    children
}: {
    active: boolean
    onClick: () => void
    icon: ReactNode
    children: ReactNode
}) {
    return (
        <button
            onClick={onClick}
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
