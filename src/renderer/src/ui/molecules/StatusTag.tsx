import type { IssueStatus } from '@domain/redmine/entities'
import { statusTone } from '@domain/redmine/status-tone'
import { customStatusColor, softChipStyle } from '@/lib/issue-colors'
import { useIssueStyle } from '@/lib/issue-style'
import { STATUS_BACKGROUND, STATUS_SOFT } from '@/lib/status-colors'
import { cn } from '@/lib/cn'

/** Status name with its color: the one the user picked for it, or the color of its family. */
export function StatusTag({ status, className }: { status: IssueStatus; className?: string }) {
    const rules = useIssueStyle()
    const tone = statusTone(status, rules)
    const custom = customStatusColor(status.id, rules)
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-px text-2xs font-medium',
                !custom && STATUS_SOFT[tone],
                className
            )}
            style={custom ? softChipStyle(custom) : undefined}
        >
            <span
                className={cn('h-1.5 w-1.5 rounded-full', !custom && STATUS_BACKGROUND[tone])}
                style={custom ? { backgroundColor: custom } : undefined}
            />
            {status.name}
        </span>
    )
}

/** Just the colored dot, for tight places such as column headers. */
export function StatusToneDot({ status, className }: { status: IssueStatus; className?: string }) {
    const rules = useIssueStyle()
    const custom = customStatusColor(status.id, rules)
    const toneClass = custom ? undefined : STATUS_BACKGROUND[statusTone(status, rules)]
    return (
        <span
            className={cn('h-2 w-2 shrink-0 rounded-full', toneClass, className)}
            style={custom ? { backgroundColor: custom } : undefined}
        />
    )
}
