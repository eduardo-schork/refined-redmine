import { CalendarDays, ChevronDown, ChevronsUp, ChevronUp, type LucideIcon } from 'lucide-react'
import type { Issue, Named } from '@domain/redmine/entities'
import { dueState, priorityLevel, type DueState, type PriorityLevel } from '@domain/redmine/issue-signals'
import { useIssueStyle } from '@/lib/issue-style'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const CHIP = 'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-2xs font-medium'

const PRIORITY_STYLES: Record<PriorityLevel, { icon?: LucideIcon; className: string }> = {
    urgent: { icon: ChevronsUp, className: 'bg-danger/15 text-danger' },
    high: { icon: ChevronUp, className: 'bg-warn/15 text-warn' },
    normal: { className: '' },
    low: { icon: ChevronDown, className: 'bg-panel-2 text-muted' }
}

/** Colored stripe on the left of a card, by priority. */
export const PRIORITY_STRIPE: Record<PriorityLevel, string> = {
    urgent: 'border-l-danger',
    high: 'border-l-warn',
    normal: 'border-l-line',
    low: 'border-l-line'
}

/** Priority name with an arrow; "normal" shows nothing, so the chip stands out when it matters. */
export function PriorityChip({ priority }: { priority: Named }) {
    const level = priorityLevel(priority, useIssueStyle())
    const style = PRIORITY_STYLES[level]
    if (!style.icon) return null
    const Icon = style.icon
    return (
        <span className={cn(CHIP, style.className)} title={priority.name}>
            <Icon size={12} strokeWidth={2.5} />
            {priority.name}
        </span>
    )
}

const DUE_STYLES: Record<DueState, string> = {
    overdue: 'bg-danger/15 text-danger',
    today: 'bg-danger/15 text-danger',
    soon: 'bg-warn/15 text-warn',
    later: 'bg-panel-2 text-muted',
    none: ''
}

/** Due date, with "yesterday", "today", "in 2 days" when it is close. */
export function DueChip({ issue, now }: { issue: Issue; now: Date }) {
    const { dates } = useI18n()
    const state = dueState(issue, now, useIssueStyle().dueSoonDays)
    if (state === 'none' || !issue.due_date) return null
    const close = state !== 'later'
    const relative = close ? ` · ${dates.relativeDays(issue.due_date, now)}` : ''
    return (
        <span className={cn(CHIP, DUE_STYLES[state])}>
            <CalendarDays size={12} />
            {dates.date(issue.due_date)}
            {relative}
        </span>
    )
}

export function VersionChip({ issue }: { issue: Issue }) {
    if (!issue.fixed_version) return null
    return <span className={cn(CHIP, 'border border-line text-fg/80')}>{issue.fixed_version.name}</span>
}
