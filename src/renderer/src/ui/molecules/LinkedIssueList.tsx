import type { ReactNode } from 'react'
import type { Issue } from '@domain/redmine/entities'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { Avatar } from '../atoms/Avatar'
import { TrackerLabel, VersionChip } from './issue-chips'
import { StatusTag } from './StatusTag'

/** One grid for every row and group label, so the columns line up across groups. */
export function LinkedIssueList({ children }: { children: ReactNode }) {
    return (
        <div className="grid grid-cols-[auto_fit-content(9rem)_minmax(0,1fr)_auto_auto_auto_minmax(0,11rem)] items-center gap-x-3">
            {children}
        </div>
    )
}

export function LinkedIssueGroupLabel({ children }: { children: ReactNode }) {
    return <div className="col-span-full mt-2 px-2 pb-0.5 text-xs text-muted first:mt-0">{children}</div>
}

/**
 * A subtask or related issue: number, tracker, title, status, version, estimate and assignee. `issue` is the loaded issue; until it
 * arrives (or when the user cannot see it) the row shows the number and the title already known, if any.
 */
export function LinkedIssueRow({
    id,
    issue,
    knownSubject,
    onOpen
}: {
    id: number
    issue?: Issue
    knownSubject?: string
    onOpen: (id: number) => void
}) {
    const { t } = useI18n()
    const isClosed = Boolean(issue?.status.is_closed)
    const subject = issue?.subject ?? knownSubject ?? '—'
    const tooltip = issue ? `${issue.tracker.name} #${id}: ${subject}` : subject
    return (
        <button
            type="button"
            onClick={() => onOpen(id)}
            className="col-span-full grid cursor-default grid-cols-subgrid items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2"
        >
            <span className={cn('tabular-nums text-accent', isClosed && 'line-through opacity-70')}>#{id}</span>
            {issue ? <TrackerLabel tracker={issue.tracker} className="text-xs text-muted" /> : <span />}
            <span className={cn('min-w-0 truncate', isClosed && 'text-muted')} title={tooltip}>
                {subject}
            </span>
            <span className="justify-self-start">{issue && <StatusTag status={issue.status} />}</span>
            <span className="justify-self-start">{issue && <VersionChip issue={issue} />}</span>
            <Estimate hours={issue?.estimated_hours} />
            <Assignee issue={issue} noAssigneeLabel={t('board.noAssignee')} />
        </button>
    )
}

function Estimate({ hours }: { hours?: number | null }) {
    const { t, dates } = useI18n()
    if (!hours) return <span />
    return (
        <span className="text-xs tabular-nums text-muted" title={t('issue.estimateTitle')}>
            {dates.hours(hours)}
        </span>
    )
}

function Assignee({ issue, noAssigneeLabel }: { issue?: Issue; noAssigneeLabel: string }) {
    if (!issue) return <span />
    const name = issue.assigned_to?.name
    if (!name) return <span className="truncate text-xs italic text-muted">{noAssigneeLabel}</span>
    return (
        <span className="flex min-w-0 items-center gap-2 text-xs">
            <Avatar name={name} />
            <span className="truncate">{name}</span>
        </span>
    )
}
