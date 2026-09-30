import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <kbd className={cn('rounded border border-line px-1 font-sans text-2xs text-muted', className)}>{children}</kbd>
    )
}
