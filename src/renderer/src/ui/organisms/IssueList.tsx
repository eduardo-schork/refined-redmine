import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react'
import {
    groupIssues,
    sortIssues,
    type IssueGroup,
    type ListColumn,
    type ListGroupBy,
    type ListSort
} from '@domain/board/issue-list'
import type { Issue } from '@domain/redmine/entities'
import { dueState, priorityLevel, type DueState } from '@domain/redmine/issue-signals'
import { useStatuses } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { useIssueStyle } from '@/lib/issue-style'
import { cn } from '@/lib/cn'
import { Avatar } from '../atoms/Avatar'
import { PriorityChip, VersionChip } from '../molecules/issue-chips'
import { StatusTag } from '../molecules/StatusTag'

const COLUMNS: { column: ListColumn; labelKey: string }[] = [
    { column: 'id', labelKey: 'board.list.column.id' },
    { column: 'tracker', labelKey: 'board.list.column.tracker' },
    { column: 'status', labelKey: 'board.list.column.status' },
    { column: 'priority', labelKey: 'board.list.column.priority' },
    { column: 'subject', labelKey: 'board.list.column.subject' },
    { column: 'assignee', labelKey: 'board.list.column.assignee' },
    { column: 'version', labelKey: 'board.list.column.version' },
    { column: 'due', labelKey: 'board.list.column.due' }
]

const GRID = 'grid grid-cols-[5rem_8.5rem_10rem_7rem_minmax(0,1fr)_11rem_6rem_6.5rem] items-center gap-3 px-4'

const DUE_TONE: Record<DueState, string> = {
    overdue: 'font-medium text-danger',
    today: 'font-medium text-danger',
    soon: 'font-medium text-warn',
    later: '',
    none: 'text-muted'
}

/** Redmine-style issue list: sortable columns and collapsible groups with counts. Clicking a row opens the issue. */
export function IssueList({
    issues,
    groupBy,
    sort,
    onSort,
    onOpen,
    loading
}: {
    issues: Issue[]
    groupBy: ListGroupBy
    sort: ListSort
    onSort: (column: ListColumn) => void
    onOpen: (id: number) => void
    loading: boolean
}) {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const loadedStatuses = useStatuses().data
    const statuses = useMemo(() => loadedStatuses ?? [], [loadedStatuses])
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const groups = useMemo(() => {
        const statusOrder = statuses.map((status) => status.id)
        const sorted = sortIssues(issues, sort, { rules, statusOrder })
        return groupIssues(sorted, groupBy, statuses)
    }, [issues, sort, rules, statuses, groupBy])

    const toggleGroup = (key: string) =>
        setCollapsed((current) => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })

    if (loading) return <div className="px-5 py-6 text-sm text-muted">{t('board.loading')}</div>
    if (!issues.length) return <div className="px-5 py-10 text-center text-sm text-muted">{t('board.list.empty')}</div>

    return (
        <div className="flex-1 overflow-auto px-4 pb-4 pt-3">
            <div className="min-w-[60rem] overflow-hidden rounded-xl border border-line bg-panel">
                <ListHeader sort={sort} onSort={onSort} />
                {groups.map((group) => (
                    <ListGroup
                        key={group.key}
                        group={group}
                        showHeader={groupBy !== 'none'}
                        groupBy={groupBy}
                        collapsed={collapsed.has(group.key)}
                        onToggle={() => toggleGroup(group.key)}
                        onOpen={onOpen}
                    />
                ))}
            </div>
        </div>
    )
}

function ListHeader({ sort, onSort }: { sort: ListSort; onSort: (column: ListColumn) => void }) {
    const { t } = useI18n()
    return (
        <div className={cn(GRID, 'sticky top-0 z-10 border-b border-line bg-panel-2 py-2')}>
            {COLUMNS.map(({ column, labelKey }) => {
                const sorted = sort.column === column
                const Arrow = sort.direction === 'asc' ? ArrowUp : ArrowDown
                const direction = sort.direction === 'asc' ? 'ascending' : 'descending'
                return (
                    <div key={column} role="columnheader" aria-sort={sorted ? direction : undefined}>
                        <button
                            type="button"
                            onClick={() => onSort(column)}
                            className={cn(
                                'flex cursor-default items-center gap-1 text-left text-2xs font-semibold uppercase tracking-wide',
                                sorted ? 'text-fg' : 'text-muted hover:text-fg'
                            )}
                        >
                            {t(labelKey as 'board.list.column.id')}
                            {sorted && <Arrow size={12} />}
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

const NO_VALUE_LABEL: Partial<Record<ListGroupBy, string>> = {
    version: 'board.filters.noVersion',
    assignee: 'board.noAssignee'
}

function ListGroup({
    group,
    showHeader,
    groupBy,
    collapsed,
    onToggle,
    onOpen
}: {
    group: IssueGroup
    showHeader: boolean
    groupBy: ListGroupBy
    collapsed: boolean
    onToggle: () => void
    onOpen: (id: number) => void
}) {
    const { t } = useI18n()
    const Chevron = collapsed ? ChevronRight : ChevronDown
    const label = group.label ?? t((NO_VALUE_LABEL[groupBy] ?? 'board.filters.none') as 'board.filters.none')
    return (
        <section>
            {showHeader && (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={!collapsed}
                    className="flex w-full cursor-default items-center gap-2 border-b border-line bg-panel px-4 py-2 text-left hover:bg-panel-2"
                >
                    <Chevron size={15} className="text-muted" />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="rounded bg-panel-2 px-1.5 text-2xs font-semibold tabular-nums text-muted">
                        {group.issues.length}
                    </span>
                </button>
            )}
            {!collapsed && group.issues.map((issue) => <ListRow key={issue.id} issue={issue} onOpen={onOpen} />)}
        </section>
    )
}

function ListRow({ issue, onOpen }: { issue: Issue; onOpen: (id: number) => void }) {
    const { t, dates } = useI18n()
    const due = dueState(issue, new Date())
    const assignee = issue.assigned_to?.name
    return (
        <button
            type="button"
            onClick={() => onOpen(issue.id)}
            className={cn(
                GRID,
                'w-full cursor-default border-b border-line py-2 text-left text-sm last:border-b-0 hover:bg-panel-2'
            )}
        >
            <span className="font-semibold tabular-nums text-fg/85">#{issue.id}</span>
            <span className="truncate text-fg/85">{issue.tracker.name}</span>
            <span className="min-w-0">
                <StatusTag status={issue.status} className="max-w-full truncate" />
            </span>
            <span className="min-w-0">
                <PriorityCell issue={issue} />
            </span>
            <span className="min-w-0 truncate" title={issue.subject}>
                {issue.subject}
            </span>
            <span className="flex min-w-0 items-center gap-2">
                <Avatar name={assignee} />
                <span className={cn('truncate', !assignee && 'italic text-muted')}>
                    {assignee ?? t('board.noAssignee')}
                </span>
            </span>
            <span className="min-w-0">
                <VersionChip issue={issue} />
            </span>
            <span className={cn('tabular-nums', DUE_TONE[due])}>
                {issue.due_date ? dates.date(issue.due_date) : '—'}
            </span>
        </button>
    )
}

/** Normal priority has no chip (to keep attention on the others): the column still says what it is. */
function PriorityCell({ issue }: { issue: Issue }) {
    const rules = useIssueStyle()
    if (priorityLevel(issue.priority, rules) !== 'normal') return <PriorityChip priority={issue.priority} />
    return <span className="text-muted">{issue.priority.name}</span>
}
