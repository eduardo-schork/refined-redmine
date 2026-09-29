import { useMemo, useState } from 'react'
import { KanbanSquare } from 'lucide-react'
import type { Issue, IssueStatus } from '@domain/redmine/entities'
import type { Sprint } from '@domain/sprint/sprint'
import { useVersionIssues } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { Avatar } from '../atoms/Avatar'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { Select } from '../atoms/fields'
import { Dialog } from '../molecules/Dialog'
import { ToggleField } from '../molecules/Field'
import { PhaseBadge } from '../molecules/sprint'
import { useOpenIssue } from './IssueModal'

function uniqueAssigneeNames(issues: Issue[]): string[] {
    const names = issues.map((issue) => issue.assigned_to?.name).filter((name): name is string => Boolean(name))
    return [...new Set(names)].sort()
}

// Open statuses first, then in Redmine status order.
function groupByStatus(issues: Issue[], statusOrder: Map<number, number>) {
    const distinctStatuses = [...new Map(issues.map((issue) => [issue.status.id, issue.status])).values()]
    const compareStatuses = (left: IssueStatus, right: IssueStatus) => {
        const closedDifference = Number(left.is_closed) - Number(right.is_closed)
        if (closedDifference !== 0) return closedDifference
        return (statusOrder.get(left.id) ?? 0) - (statusOrder.get(right.id) ?? 0)
    }
    return distinctStatuses.sort(compareStatuses).map((status) => ({
        status,
        items: issues.filter((issue) => issue.status.id === status.id)
    }))
}

export function SprintIssuesDialog({
    sprint,
    onClose,
    onCreateBoard
}: {
    sprint: Sprint
    onClose: () => void
    onCreateBoard: () => void
}) {
    const { t, dates, error } = useI18n()
    const statuses = useStatuses()
    const myUserId = useSettings().user?.id
    const issues = useVersionIssues(sprint.version.id)
    const [onlyMine, setOnlyMine] = useState(false)
    const [assignee, setAssignee] = useState('')

    const allIssues = useMemo(() => issues.data?.items ?? [], [issues.data])
    const people = useMemo(() => uniqueAssigneeNames(allIssues), [allIssues])
    const matchesFilters = (issue: Issue) => {
        const mineOk = !onlyMine || issue.assigned_to?.id === myUserId
        const assigneeOk = !assignee || issue.assigned_to?.name === assignee
        return mineOk && assigneeOk
    }
    const visibleIssues = allIssues.filter(matchesFilters)
    const statusOrder = new Map((statuses.data ?? []).map((status, index) => [status.id, index]))
    const groups = groupByStatus(visibleIssues, statusOrder)
    const isEmpty = Boolean(issues.data) && visibleIssues.length === 0

    return (
        <Dialog
            size="lg"
            title={sprint.version.name}
            onClose={onClose}
            footer={
                <Button variant="primary" onClick={onCreateBoard}>
                    <KanbanSquare size={14} /> {t('sprints.createBoard')}
                </Button>
            }
        >
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <PhaseBadge phase={sprint.phase} />
                <span className="text-xs text-muted">
                    {t('sprints.datesLine', {
                        dev: dates.date(sprint.devDeadline, true),
                        release: dates.date(sprint.release, true)
                    })}
                </span>
                <div className="ml-auto flex items-center gap-3">
                    <Select className="w-48" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                        <option value="">{t('sprints.allAssignees')}</option>
                        {people.map((person) => (
                            <option key={person}>{person}</option>
                        ))}
                    </Select>
                    <div className="w-32">
                        <ToggleField checked={onlyMine} onChange={setOnlyMine} label={t('sprints.onlyMine')} />
                    </div>
                </div>
            </div>

            {issues.isLoading && <p className="text-[13px] text-muted">{t('sprints.loadingIssues')}</p>}
            {issues.isError && <p className="text-[13px] text-danger">{error(issues.error)}</p>}
            {isEmpty && <p className="text-[13px] text-muted">{t('sprints.noIssues')}</p>}

            <div className="flex flex-col gap-4">
                {groups.map((group) => (
                    <StatusGroup key={group.status.id} status={group.status} issues={group.items} />
                ))}
            </div>
        </Dialog>
    )
}

function StatusGroup({ status, issues }: { status: IssueStatus; issues: Issue[] }) {
    const openIssue = useOpenIssue()
    return (
        <div>
            <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-semibold">{status.name}</span>
                <Badge>{issues.length}</Badge>
            </div>
            <ul className="overflow-hidden rounded-lg border border-line">
                {issues.map((issue) => (
                    <li key={issue.id}>
                        <button
                            onClick={() => openIssue(issue.id)}
                            className="flex w-full cursor-default items-center gap-3 border-b border-line px-3 py-1.5 text-left text-[13px] last:border-0 hover:bg-panel-2"
                        >
                            <span className="w-16 shrink-0 text-xs tabular-nums text-muted">#{issue.id}</span>
                            <span className="w-28 shrink-0 truncate text-xs text-muted">{issue.tracker.name}</span>
                            <span className="min-w-0 flex-1 truncate">{issue.subject}</span>
                            <Avatar name={issue.assigned_to?.name} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
