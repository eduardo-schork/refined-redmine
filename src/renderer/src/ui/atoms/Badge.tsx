import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'outline'

const TONES: Record<BadgeTone, string> = {
    neutral: 'bg-panel-2 text-muted',
    accent: 'bg-accent text-on-accent font-semibold',
    outline: 'border border-line text-muted'
}

export function Badge({
    children,
    tone = 'neutral',
    className,
    title
}: {
    children: ReactNode
    tone?: BadgeTone
    className?: string
    title?: string
}) {
    return (
        <span
            title={title}
            className={cn('inline-flex shrink-0 items-center rounded px-1.5 text-[11px]', TONES[tone], className)}
        >
            {children}
        </span>
    )
}
