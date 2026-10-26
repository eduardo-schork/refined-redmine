import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Badge } from '../atoms/Badge'
import { Overline } from '../atoms/misc'

export function Card({
    title,
    description,
    actions,
    children
}: {
    title: string
    description?: string
    actions?: ReactNode
    children: ReactNode
}) {
    return (
        <section className="rounded-xl border border-line bg-panel">
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
                <div>
                    <h2 className="text-base font-semibold">{title}</h2>
                    {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{actions}</div>}
            </header>
            <div className="px-5 py-4">{children}</div>
        </section>
    )
}

export function Panel({
    title,
    count,
    hint,
    header,
    action,
    id,
    children
}: {
    title: string
    id?: string
    count?: number
    hint?: string
    header?: ReactNode
    action?: ReactNode
    children: ReactNode
}) {
    return (
        <section id={id} className="scroll-mt-4 overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex items-center gap-2 px-4 pb-2 pt-3">
                <h3 className="text-sm font-semibold">{title}</h3>
                {count !== undefined && <Badge>{count}</Badge>}
                {hint && <span className="truncate text-xs text-muted">{hint}</span>}
                <span className="ml-auto">{action}</span>
            </div>
            {header}
            <div>{children}</div>
        </section>
    )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
    return (
        <div className="mb-2 flex items-center justify-between">
            <Overline>{children}</Overline>
            {action}
        </div>
    )
}

export function StatTile({
    label,
    value,
    icon,
    tone,
    onClick
}: {
    label: string
    value: ReactNode
    icon: ReactNode
    tone?: 'warn' | 'danger'
    onClick?: () => void
}) {
    const toneClass = cn(tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className="flex cursor-default flex-col justify-between gap-1 rounded-xl border border-line bg-panel px-4 py-3 text-left enabled:hover:border-muted/60 enabled:hover:bg-panel-2"
        >
            <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className={toneClass}>{icon}</span>
                {label}
            </span>
            <span className={cn('text-3xl font-semibold leading-tight tabular-nums', toneClass)}>{value}</span>
        </button>
    )
}

type AlertTone = 'error' | 'warning' | 'info'

const ALERT_TONES: Record<AlertTone, string> = {
    error: 'bg-accent-soft text-danger',
    warning: 'bg-warn/10 text-warn',
    info: 'bg-panel-2 text-muted'
}

export function Alert({
    children,
    tone = 'error',
    className
}: {
    children: ReactNode
    tone?: AlertTone
    className?: string
}) {
    return <div className={cn('rounded-lg px-4 py-3 text-sm', ALERT_TONES[tone], className)}>{children}</div>
}

export function EmptyRow({ children }: { children: ReactNode }) {
    return <div className="border-t border-line px-4 py-6 text-center text-sm text-muted">{children}</div>
}

export function EmptyState({
    icon,
    title,
    text,
    action
}: {
    icon: ReactNode
    title: string
    text: string
    action?: ReactNode
}) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="text-muted">{icon}</span>
            <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
            {action}
        </div>
    )
}

export function Property({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="mb-3">
            <div className="mb-0.5 text-2xs text-muted">{label}</div>
            <div className="select-text">{children}</div>
        </div>
    )
}
