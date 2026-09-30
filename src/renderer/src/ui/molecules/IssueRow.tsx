import type { ReactNode } from 'react'
import type { Issue } from '@domain/redmine/entities'
import { PriorityChip, VersionChip } from './issue-chips'

export function IssueRow({ issue, onOpen, right }: { issue: Issue; onOpen: (id: number) => void; right: ReactNode }) {
    return (
        <button
            onClick={() => onOpen(issue.id)}
            className="flex w-full cursor-default items-center gap-3 border-t border-line px-4 py-2 text-left text-sm hover:bg-panel-2"
        >
            <span className="w-14 shrink-0 text-xs tabular-nums text-muted">#{issue.id}</span>
            <span className="min-w-0 flex-1 truncate">{issue.subject}</span>
            <PriorityChip priority={issue.priority} />
            <VersionChip issue={issue} />
            <span className="max-w-40 shrink-0 truncate text-xs">{right}</span>
        </button>
    )
}
