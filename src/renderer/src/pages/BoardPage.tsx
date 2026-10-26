import { useEffect, useMemo, useState } from 'react'
import { KanbanSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Board } from '@domain/board/board'
import { newIssueDefaults } from '@domain/board/board-rules'
import { nextSort, type ListGroupBy } from '@domain/board/issue-list'
import { EMPTY_QUICK_FILTER, matchesQuickFilter, NONE } from '@domain/board/quick-filter'
import type { Issue } from '@domain/redmine/entities'
import type { Sprint } from '@domain/sprint/sprint'
import { countSignals, hasSignal, type IssueSignal } from '@domain/redmine/issue-signals'
import { useBoardIssues, useDeleteBoard } from '@/hooks/boards'
import { useSettings } from '@/hooks/session'
import { useIssueStyle } from '@/lib/issue-style'
import { loadViewPrefs, saveViewPrefs, type BoardViewPrefs } from '@/lib/board-view-prefs'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/ui/atoms/Button'
import { IconButton } from '@/ui/atoms/IconButton'
import { RefreshButton } from '@/ui/molecules/RefreshButton'
import { SegmentedControl } from '@/ui/molecules/SegmentedControl'
import { SignalFilter } from '@/ui/molecules/SignalFilter'
import { Alert, EmptyState } from '@/ui/molecules/surfaces'
import { BoardEditor } from '@/ui/organisms/BoardEditor'
import { BoardFilters } from '@/ui/organisms/BoardFilters'
import { BoardSummary } from '@/ui/organisms/BoardSummary'
import { useNewIssue, useOpenIssue, useScreenIssueDefaults } from '@/ui/organisms/IssueModal'
import { IssueList } from '@/ui/organisms/IssueList'
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
    return <BoardView key={board.id} board={board} onDeleted={onDeleted} />
}

type BoardViewMode = BoardViewPrefs['mode']

/** View, quick filters, list grouping and sort of this board, remembered on this computer. */
function useBoardViewPrefs(boardId: string) {
    const [prefs, setPrefs] = useState(() => loadViewPrefs(boardId))
    useEffect(() => saveViewPrefs(boardId, prefs), [boardId, prefs])
    const update = (patch: Partial<BoardViewPrefs>) => setPrefs((current) => ({ ...current, ...patch }))
    return { prefs, update }
}

function BoardView({ board, onDeleted }: { board: Board; onDeleted: () => void }) {
    const { t, error } = useI18n()
    const boardIssues = useBoardIssues(board.id)
    const remove = useDeleteBoard()
    const openNewIssue = useNewIssue()
    const [editing, setEditing] = useState(false)
    const [signal, setSignal] = useState<IssueSignal | null>(null)
    const { prefs, update } = useBoardViewPrefs(board.id)
    const { mode, filter } = prefs
    const staleDays = useSettings().dashboard.staleDays
    const rules = useIssueStyle()

    const allIssues = useMemo(() => boardIssues.data?.issues.items ?? [], [boardIssues.data])
    const filtered = useMemo(() => allIssues.filter((issue) => matchesQuickFilter(issue, filter)), [allIssues, filter])
    // Counted before the signal filter, so the other counters stay visible while one is selected.
    const signalOptions = { staleDays, now: new Date(), rules }
    const signalCounts = countSignals(filtered, signalOptions)
    const visible = signal ? filtered.filter((issue) => hasSignal(issue, signal, signalOptions)) : filtered
    const data = boardIssues.data
    useScreenIssueDefaults(newIssueDefaults(board, data?.sprint?.version))
    const source = board.source
    const autoSprintLabel = source.type === 'sprint' && source.auto ? t(`sprint.auto.${source.auto}`) : undefined

    const viewOptions: { value: BoardViewMode; label: string }[] = [
        { value: 'board', label: t('board.view.board') },
        { value: 'list', label: t('board.view.list') },
        { value: 'summary', label: t('board.view.summary') }
    ]

    /** From the summary: back to the board, showing only that person's cards. */
    function showPerson(assigneeId: number | undefined) {
        const assignees = [assigneeId === undefined ? NONE : String(assigneeId)]
        update({ mode: 'board', filter: { ...EMPTY_QUICK_FILTER, assignees } })
        setSignal(null)
    }

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
            loading={boardIssues.isFetching}
            title={board.name}
            subtitle={
                <BoardSubtitle board={board} data={data} visibleCount={visible.length} totalCount={allIssues.length} />
            }
            actions={
                <>
                    <Button onClick={() => openNewIssue()}>
                        <Plus size={14} /> {t('issue.create.button')}
                    </Button>
                    <SegmentedControl value={mode} options={viewOptions} onChange={(next) => update({ mode: next })} />
                    <RefreshButton spinning={boardIssues.isFetching} onClick={() => void boardIssues.refetch()} />
                    <IconButton label={t('board.edit')} icon={<Pencil size={14} />} onClick={() => setEditing(true)} />
                    <IconButton
                        label={t('board.delete')}
                        tone="danger"
                        icon={<Trash2 size={14} />}
                        onClick={confirmDelete}
                    />
                </>
            }
        >
            {data?.unresolvedSprint && (
                <Alert tone="info" className="m-4">
                    {unresolvedSprintMessage(data.sprintsConfigured)}
                </Alert>
            )}
            {boardIssues.isError && <Alert className="m-4">{error(boardIssues.error)}</Alert>}
            <BoardBody
                board={board}
                prefs={prefs}
                update={update}
                allIssues={allIssues}
                visible={visible}
                loading={boardIssues.isLoading}
                sprint={data?.sprint}
                signal={{ counts: signalCounts, active: signal, onChange: setSignal }}
                onSelectPerson={showPerson}
            />
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
    visibleCount,
    totalCount
}: {
    board: Board
    data: BoardIssues | undefined
    visibleCount: number
    totalCount: number
}) {
    const { t } = useI18n()
    const source = board.source
    const truncated = data && data.issues.total > data.issues.items.length
    const isFiltered = visibleCount < totalCount
    const countLabel = isFiltered
        ? t('board.filters.countOf', { shown: visibleCount, total: totalCount })
        : t('common.count', { count: visibleCount })
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
            <span className="text-xs text-muted">{data ? countLabel : ''}</span>
            {truncated && (
                <span className="text-xs text-warn">
                    {t('common.showingOf', { shown: data.issues.items.length, total: data.issues.total })}
                </span>
            )}
        </>
    )
}

function BoardBody({
    board,
    prefs,
    update,
    allIssues,
    visible,
    loading,
    sprint,
    signal,
    onSelectPerson
}: {
    board: Board
    prefs: BoardViewPrefs
    update: (patch: Partial<BoardViewPrefs>) => void
    allIssues: Issue[]
    visible: Issue[]
    loading: boolean
    sprint?: Sprint
    signal: {
        counts: Record<IssueSignal, number>
        active: IssueSignal | null
        onChange: (signal: IssueSignal | null) => void
    }
    onSelectPerson: (assigneeId: number | undefined) => void
}) {
    const openIssue = useOpenIssue()
    const { mode, filter, groupBy, sort } = prefs
    const laneBy = prefs.laneBy ?? board.swimlanes
    if (mode === 'summary') {
        return <BoardSummary board={board} sprint={sprint} issues={allIssues} onSelectPerson={onSelectPerson} />
    }
    const isList = mode === 'list'
    const changeGrouping = (next: ListGroupBy) => update(isList ? { groupBy: next } : { laneBy: next })
    return (
        <>
            <BoardFilters
                issues={allIssues}
                filter={filter}
                onChange={(next) => update({ filter: next })}
                groupBy={isList ? groupBy : laneBy}
                onGroupBy={changeGrouping}
            />
            <SignalFilter counts={signal.counts} active={signal.active} onChange={signal.onChange} />
            {mode === 'board' && (
                <KanbanBoard board={board} laneBy={laneBy} issues={visible} loading={loading} onOpen={openIssue} />
            )}
            {mode === 'list' && (
                <IssueList
                    issues={visible}
                    groupBy={groupBy}
                    sort={sort}
                    onSort={(column) => update({ sort: nextSort(sort, column) })}
                    onOpen={openIssue}
                    loading={loading}
                />
            )}
        </>
    )
}
