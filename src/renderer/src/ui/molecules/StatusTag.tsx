import type { IssueStatus } from '@domain/redmine/entities'
import { statusTone } from '@domain/redmine/status-tone'
import { useIssueStyle } from '@/lib/issue-style'
import { STATUS_BACKGROUND, STATUS_SOFT } from '@/lib/status-colors'
import { cn } from '@/lib/cn'

/** Status name with the color of its family (new, in progress, review, testing, blocked, done). */
export function StatusTag({ status, className }: { status: IssueStatus; className?: string }) {
    const tone = statusTone(status, useIssueStyle())
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-px text-2xs font-medium',
                STATUS_SOFT[tone],
                className
            )}
        >
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_BACKGROUND[tone])} />
            {status.name}
        </span>
    )
}

/** Just the colored dot, for tight places such as column headers. */
export function StatusToneDot({ status, className }: { status: IssueStatus; className?: string }) {
    const tone = statusTone(status, useIssueStyle())
    return <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_BACKGROUND[tone], className)} />
}
