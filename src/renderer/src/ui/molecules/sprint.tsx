import type { ReactNode } from 'react'
import type { SprintPhase } from '@domain/sprint/sprint'
import { daysUntil } from '@domain/shared/date'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const PHASE_TONE: Record<SprintPhase, string> = {
    dev: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
    qa: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    late: 'bg-danger/15 text-danger',
    planned: 'bg-panel-2 text-muted',
    production: 'bg-ok/15 text-ok',
    hotfix: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
    released: 'bg-panel-2 text-muted',
    other: 'bg-panel-2 text-muted'
}

export function PhaseBadge({ phase }: { phase: SprintPhase }) {
    const { t } = useI18n()
    return (
        <span
            className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                PHASE_TONE[phase]
            )}
        >
            {t(`sprint.phase.${phase}`)}
        </span>
    )
}

/** "Dev deadline 06/10 · in 8 days", highlighting upcoming or overdue deadlines. */
export function DateCountdown({
    icon,
    label,
    date,
    highlight
}: {
    icon: ReactNode
    label: string
    date?: string
    highlight: boolean
}) {
    const { dates } = useI18n()
    if (!date) return null
    const today = new Date()
    const daysLeft = daysUntil(date, today)
    // Deadlines within the next 3 days are a warning; past deadlines are overdue.
    const isDueSoon = highlight && daysLeft >= 0 && daysLeft <= 3
    const isOverdue = highlight && daysLeft < 0
    return (
        <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted">{icon}</span>
            <span className="text-muted">{label}</span>
            <span className="font-medium">{dates.date(date)}</span>
            <span
                className={cn(
                    'text-muted',
                    isDueSoon && 'font-medium text-warn',
                    isOverdue && 'font-medium text-danger'
                )}
            >
                · {dates.relativeDays(date, today)}
            </span>
        </div>
    )
}
