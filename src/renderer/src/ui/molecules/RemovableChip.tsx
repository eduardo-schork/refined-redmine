import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function RemovableChip({
    children,
    onRemove,
    className
}: {
    children: ReactNode
    onRemove: () => void
    className?: string
}) {
    return (
        <span
            className={cn(
                'inline-flex h-7 items-center gap-1 rounded-md border border-line bg-panel-2 px-2 text-xs',
                className
            )}
        >
            {children}
            <button type="button" className="text-muted hover:text-fg" onClick={onRemove}>
                <X size={12} />
            </button>
        </span>
    )
}
