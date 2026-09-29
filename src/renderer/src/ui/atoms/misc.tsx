import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function ColorDot({ color, className }: { color: string; className?: string }) {
    return <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: color }} />
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value))

export function ProgressBar({ value, className }: { value: number; className?: string }) {
    return (
        <div className={cn('h-1.5 overflow-hidden rounded-full bg-ok/15', className)}>
            <div className="h-full rounded-full bg-ok" style={{ width: `${clampPercent(value)}%` }} />
        </div>
    )
}

export function Overline({ children, className }: { children: ReactNode; className?: string }) {
    return <h2 className={cn('text-[11px] font-semibold uppercase tracking-wide text-muted', className)}>{children}</h2>
}

export function TextLink({
    onClick,
    children,
    className
}: {
    onClick: () => void
    children: ReactNode
    className?: string
}) {
    return (
        <button type="button" onClick={onClick} className={cn('text-left text-accent hover:underline', className)}>
            {children}
        </button>
    )
}

const STATUS_DOT_COLORS = { ok: 'bg-ok', muted: 'bg-muted', danger: 'bg-danger', accent: 'bg-accent' }

export function StatusDot({ tone }: { tone: keyof typeof STATUS_DOT_COLORS }) {
    return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_COLORS[tone])} />
}
