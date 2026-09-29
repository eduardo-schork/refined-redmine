import { useMemo, useState } from 'react'
import { KanbanSquare, Pencil, Trash2 } from 'lucide-react'
import type { Board } from '@domain/board/board'
import type { Issue } from '@domain/redmine/entities'
import { useBoardIssues, useDeleteBoard } from '@/hooks/boards'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/ui/atoms/Button'
import { Select } from '@/ui/atoms/fields'
import { IconButton } from '@/ui/atoms/IconButton'
import { RefreshButton } from '@/ui/molecules/RefreshButton'
import { SearchInput } from '@/ui/molecules/SearchInput'
import { Alert, EmptyState } from '@/ui/molecules/surfaces'
import { BoardEditor } from '@/ui/organisms/BoardEditor'
import { useOpenIssue } from '@/ui/organisms/IssueModal'
import { KanbanBoard } from '@/ui/organisms/KanbanBoard'
import { PageLayout } from '@/ui/templates/layouts'

export default function BoardPage({
    boardId,
    onCreate,
    onDeleted
}: {
    boardId?: string
    onCreate: () => void
    onDeleted: () => void
}) {
    const { t } = useI18n()
    const board = useSettings().boards.find((candidate) => candidate.id === boardId)
    if (!board) {
        return (
            <div className="flex h-full flex-col">
                <div className="drag h-12 shrink-0" />
                <EmptyState
                    icon={<KanbanSquare size={36} />}
                    title={t('board.emptyTitle')}
                    text={t('board.emptyText')}
                    action={
                        <Button variant="primary" onClick={onCreate}>
                            {t('board.create')}
                        </Button>
                    }
                />
            </div>
        )
    }
    return <BoardView board={board} onDeleted={onDeleted} />
}

function assigneeName(issue: Issue, noAssignee: string): string {
    return issue.assigned_to?.name ?? noAssignee
}

function matchesSearch(issue: Issue, searchText: string): boolean {
    if (!searchText) return true
    const inSubject = issue.subject.toLowerCase().includes(searchText)
    const inId = String(issue.id).includes(searchText)
    const inProject = issue.project.name.toLowerCase().includes(searchText)
    return inSubject || inId || inProject
}

function BoardView({ board, onDeleted }: { board: Board; onDeleted: () => void }) {
    const { t, error } = useI18n()
    const openIssue = useOpenIssue()
    const boardIssues = useBoardIssues(board.id)
    const remove = useDeleteBoard()
    const [editing, setEditing] = useState(false)
    const [search, setSearch] = useState('')
    const [assignee, setAssignee] = useState('')
    const noAssignee = t('board.noAssignee')

    const allIssues = useMemo(() => boardIssues.data?.issues.items ?? [], [boardIssues.data])
    const assignees = useMemo(() => {
        const names = allIssues.map((issue) => assigneeName(issue, noAssignee))
        return [...new Set(names)].sort()
    }, [allIssues, noAssignee])
    const searchText = search.trim().toLowerCase()
    const visible = allIssues.filter((issue) => {
        const matchesAssignee = !assignee || assigneeName(issue, noAssignee) === assignee
        return matchesAssignee && matchesSearch(issue, searchText)
    })
    const data = boardIssues.data
    const source = board.source
    const autoSprintLabel = source.type === 'sprint' && source.auto ? t(`sprint.auto.${source.auto}`) : undefined

    function confirmDelete() {
        if (!confirm(t('board.confirmDelete', { name: board.name }))) return
        remove.mutate(board.id, { onSuccess: onDeleted })
    }

    function unresolvedSprintMessage(sprintsConfigured: boolean): string {
        if (!sprintsConfigured) return t('board.configureSprints')
        return t('board.noVersion', { label: autoSprintLabel ?? t('board.thisSprint') })
    }

    return (
        <PageLayout
            title={board.name}
            subtitle={<BoardSubtitle board={board} data={data} visibleCount={visible.length} />}
            actions={
                <>
                    <SearchInput
                        className="w-56"
                        value={search}
                        onChange={setSearch}
                        placeholder={t('board.searchPlaceholder')}
                    />
                    <Select className="w-44" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                        <option value="">{t('board.allAssignees')}</option>
                        {assignees.map((name) => (
                            <option key={name}>{name}</option>
                        ))}
                    </Select>
                    <RefreshButton spinning={boardIssues.isFetching} onClick={() => void boardIssues.refetch()} />
                    <IconButton label={t('board.edit')} icon={<Pencil size={14} />} onClick={() => setEditing(true)} />
                    <IconButton label={t('board.delete')} icon={<Trash2 size={14} />} onClick={confirmDelete} />
                </>
            }
        >
            {data?.unresolvedSprint && (
                <Alert tone="info" className="m-4">
                    {unresolvedSprintMessage(data.sprintsConfigured)}
                </Alert>
            )}
            {boardIssues.isError && <Alert className="m-4">{error(boardIssues.error)}</Alert>}
            <KanbanBoard board={board} issues={visible} loading={boardIssues.isLoading} onOpen={openIssue} />
            {editing && (
                <BoardEditor board={board} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
            )}
        </PageLayout>
    )
}

type BoardIssues = NonNullable<ReturnType<typeof useBoardIssues>['data']>

function BoardSubtitle({
    board,
    data,
    visibleCount
}: {
    board: Board
    data: BoardIssues | undefined
    visibleCount: number
}) {
    const { t } = useI18n()
    const source = board.source
    const truncated = data && data.issues.total > data.issues.items.length
    return (
        <>
            {source.type === 'sprint' && data?.sprint && (
                <span
                    className="rounded-md bg-panel-2 px-1.5 py-0.5 text-xs"
                    title={source.auto ? t(`sprint.auto.${source.auto}`) : undefined}
                >
                    {data.sprint.version.name}
                    {source.auto && <span className="text-muted"> · {t('board.automatic')}</span>}
                </span>
            )}
            <span className="text-xs text-muted">{data ? t('common.count', { count: visibleCount }) : ''}</span>
            {truncated && (
                <span className="text-xs text-warn">
                    {t('common.showingOf', { shown: data.issues.items.length, total: data.issues.total })}
                </span>
            )}
        </>
    )
}
