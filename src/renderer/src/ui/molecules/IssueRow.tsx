import type { ReactNode } from 'react'
import type { Issue } from '@domain/redmine/entities'
import { Badge } from '../atoms/Badge'

export function IssueRow({ issue, onOpen, right }: { issue: Issue; onOpen: (id: number) => void; right: ReactNode }) {
    return (
        <button
            onClick={() => onOpen(issue.id)}
            className="flex w-full cursor-default items-center gap-3 border-t border-line px-4 py-2 text-left text-[13px] hover:bg-panel-2"
        >
            <span className="w-14 shrink-0 text-xs tabular-nums text-muted">#{issue.id}</span>
            <span className="min-w-0 flex-1 truncate">{issue.subject}</span>
            {issue.fixed_version && <Badge tone="outline">{issue.fixed_version.name}</Badge>}
            <span className="max-w-40 shrink-0 truncate text-xs">{right}</span>
        </button>
    )
}
