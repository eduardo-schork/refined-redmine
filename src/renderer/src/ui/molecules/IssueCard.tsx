import { CalendarDays } from 'lucide-react'
import type { Issue } from '@domain/redmine/entities'
import { isOverdue } from '@domain/redmine/queue'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Avatar } from '../atoms/Avatar'
import { Badge } from '../atoms/Badge'

// Matches Redmine priority names, which may be in Portuguese or English.
function priorityTone(name: string): string | null {
    if (/imediat|urgent|crít|critic|immediate/i.test(name)) return 'bg-danger'
    if (/alta|high/i.test(name)) return 'bg-warn'
    if (/baixa|low/i.test(name)) return 'bg-muted/50'
    return null
}

export function IssueCard({ issue, overlay, showStatus }: { issue: Issue; overlay?: boolean; showStatus?: boolean }) {
    const { dates } = useI18n()
    const tone = priorityTone(issue.priority.name)
    const overdue = isOverdue(issue, new Date())
    const hasProgress = issue.done_ratio > 0
    return (
        <div
            className={cn(
                'rounded-lg border border-line bg-panel p-2.5 text-[13px] shadow-sm hover:border-muted/50',
                overlay && 'rotate-1 cursor-grabbing shadow-xl'
            )}
        >
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
                {tone && <span className={cn('h-1.5 w-1.5 rounded-full', tone)} title={issue.priority.name} />}
                <span className="font-medium">#{issue.id}</span>
                <span>·</span>
                <span className="truncate">{issue.tracker.name}</span>
                {showStatus && <Badge className="ml-auto truncate">{issue.status.name}</Badge>}
            </div>
            <div className="line-clamp-3 leading-snug">{issue.subject}</div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                <Avatar name={issue.assigned_to?.name} />
                <span className="truncate">{issue.project.name}</span>
                {issue.fixed_version && <Badge tone="outline">{issue.fixed_version.name}</Badge>}
                {issue.due_date && (
                    <span className={cn('ml-auto flex shrink-0 items-center gap-0.5', overdue && 'text-danger')}>
                        <CalendarDays size={11} />
                        {dates.date(issue.due_date)}
                    </span>
                )}
            </div>
            {hasProgress && (
                <div className="mt-2 h-1 overflow-hidden rounded bg-panel-2">
                    <div className="h-full bg-ok" style={{ width: `${issue.done_ratio}%` }} />
                </div>
            )}
        </div>
    )
}
