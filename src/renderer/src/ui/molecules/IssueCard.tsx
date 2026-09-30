import { Pause } from 'lucide-react'
import type { Issue } from '@domain/redmine/entities'
import { priorityLevel } from '@domain/redmine/issue-signals'
import { isStale } from '@domain/redmine/queue'
import { daysSince } from '@domain/shared/date'
import { useIssueStyle } from '@/lib/issue-style'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Avatar } from '../atoms/Avatar'
import { DueChip, PRIORITY_STRIPE, PriorityChip, VersionChip } from './issue-chips'
import { StatusTag } from './StatusTag'

export interface IssueCardOptions {
    showStatus?: boolean
    /** Boards with more than one project show the project on each card. */
    showProject?: boolean
    staleDays: number
}

/**
 * Kanban card, one kind of information per line: number and priority, title, tags (version, due date, status),
 * then the assignee and how long ago the issue changed.
 */
export function IssueCard({ issue, overlay, options }: { issue: Issue; overlay?: boolean; options: IssueCardOptions }) {
    const now = new Date()
    const level = priorityLevel(issue.priority, useIssueStyle())
    return (
        <div
            className={cn(
                'rounded-lg border border-l-[3px] border-line bg-panel px-3 py-2.5 text-sm shadow-sm hover:border-muted/50',
                PRIORITY_STRIPE[level],
                overlay && 'rotate-1 cursor-grabbing shadow-xl'
            )}
        >
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                <span className="font-semibold tabular-nums text-fg/80">#{issue.id}</span>
                <span>·</span>
                <span className="truncate">{issue.tracker.name}</span>
                <span className="ml-auto" />
                <PriorityChip priority={issue.priority} />
            </div>
            <div className="line-clamp-3 font-medium leading-snug">{issue.subject}</div>
            <CardTags issue={issue} now={now} options={options} />
            <CardFooter issue={issue} now={now} staleDays={options.staleDays} />
            {issue.done_ratio > 0 && (
                <div className="mt-2 h-1 overflow-hidden rounded bg-panel-2" title={`${issue.done_ratio}%`}>
                    <div className="h-full bg-ok" style={{ width: `${issue.done_ratio}%` }} />
                </div>
            )}
        </div>
    )
}

function CardTags({ issue, now, options }: { issue: Issue; now: Date; options: IssueCardOptions }) {
    const hasVersion = Boolean(issue.fixed_version)
    const hasDue = Boolean(issue.due_date) && !issue.status.is_closed
    const hasTags = hasVersion || hasDue || options.showStatus || options.showProject
    if (!hasTags) return null
    return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <VersionChip issue={issue} />
            <DueChip issue={issue} now={now} />
            {options.showStatus && <StatusTag status={issue.status} />}
            {options.showProject && <span className="truncate text-2xs text-muted">{issue.project.name}</span>}
        </div>
    )
}

function CardFooter({ issue, now, staleDays }: { issue: Issue; now: Date; staleDays: number }) {
    const { t, dates } = useI18n()
    const assignee = issue.assigned_to?.name
    const stale = !issue.status.is_closed && isStale(issue, staleDays, now)
    return (
        <div className="mt-2 flex items-center gap-2 text-xs">
            <Avatar name={assignee} />
            <span className={cn('min-w-0 flex-1 truncate', assignee ? 'text-fg/80' : 'italic text-muted')}>
                {assignee ?? t('board.noAssignee')}
            </span>
            {stale ? (
                <span className="flex shrink-0 items-center gap-1 font-medium text-warn">
                    <Pause size={11} />
                    {t('board.card.stale', { count: daysSince(issue.updated_on, now) })}
                </span>
            ) : (
                <span className="shrink-0 text-muted" title={dates.dateTime(issue.updated_on)}>
                    {dates.relativeTime(issue.updated_on, now)}
                </span>
            )}
        </div>
    )
}
