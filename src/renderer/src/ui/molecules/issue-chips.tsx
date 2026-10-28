import { CalendarDays, ChevronDown, ChevronsUp, ChevronUp, Clock, type LucideIcon } from 'lucide-react'
import type { Issue, Named } from '@domain/redmine/entities'
import { dueState, priorityLevel, type DueState, type PriorityLevel } from '@domain/redmine/issue-signals'
import type { IssueStyleRules } from '@domain/redmine/issue-style'
import { customPriorityColor, softChipStyle, trackerColorStyle } from '@/lib/issue-colors'
import { useIssueStyle } from '@/lib/issue-style'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const CHIP = 'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-2xs font-medium'

const PRIORITY_STYLES: Record<PriorityLevel, { icon?: LucideIcon; className: string }> = {
    urgent: { icon: ChevronsUp, className: 'bg-pr-urgent/15 text-pr-urgent' },
    high: { icon: ChevronUp, className: 'bg-pr-high/15 text-pr-high' },
    normal: { className: '' },
    low: { icon: ChevronDown, className: 'bg-pr-low/15 text-pr-low' }
}

/**
 * Priority name with an arrow; "normal" shows nothing, so the chip stands out when it matters, unless the user
 * picked a color for it.
 */
export function PriorityChip({ priority }: { priority: Named }) {
    const rules = useIssueStyle()
    const style = PRIORITY_STYLES[priorityLevel(priority, rules)]
    const custom = customPriorityColor(priority.id, rules)
    if (!style.icon && !custom) return null
    const Icon = style.icon
    return (
        <span
            className={cn(CHIP, !custom && style.className)}
            style={custom ? softChipStyle(custom) : undefined}
            title={priority.name}
        >
            {Icon && <Icon size={12} strokeWidth={2.5} />}
            {priority.name}
        </span>
    )
}

/** Whether the priority shows a chip at all (normal priorities without a color of their own do not). */
export function hasPriorityChip(priority: Named, rules: IssueStyleRules): boolean {
    return priorityLevel(priority, rules) !== 'normal' || priority.id in rules.priorityColors
}

const DUE_STYLES: Record<DueState, string> = {
    overdue: 'bg-due-overdue/15 text-due-overdue',
    today: 'bg-due-today/15 text-due-today',
    soon: 'bg-due-soon/15 text-due-soon',
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

/** Tracker name after a dot of its color. */
export function TrackerLabel({ tracker, className }: { tracker: Named; className?: string }) {
    const style = trackerColorStyle(tracker, useIssueStyle())
    return (
        <span className={cn('tracker-color inline-flex min-w-0 items-center gap-1.5', className)} style={style}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-(--tracker)" />
            <span className="truncate">{tracker.name}</span>
        </span>
    )
}

export function VersionChip({ issue }: { issue: Issue }) {
    if (!issue.fixed_version) return null
    return <span className={cn(CHIP, 'border border-line text-fg/80')}>{issue.fixed_version.name}</span>
}

/** Redmine's "Tempo estimado" of the issue itself (not the total with subtasks); nothing when empty or zero. */
export function EstimateChip({ issue }: { issue: Issue }) {
    const { t, dates } = useI18n()
    if (!issue.estimated_hours) return null
    return (
        <span className={cn(CHIP, 'border border-line text-fg/80')} title={t('issue.estimateTitle')}>
            <Clock size={12} />
            {dates.hours(issue.estimated_hours)}
        </span>
    )
}
