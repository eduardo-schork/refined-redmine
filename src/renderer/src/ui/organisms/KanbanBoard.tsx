import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import { Ban } from 'lucide-react'
import type { Board, BoardColumn } from '@domain/board/board'
import { canDropOn, columnOf, targetStatus } from '@domain/board/board-rules'
import type { Issue } from '@domain/redmine/entities'
import { useMoveIssue } from '@/hooks/boards'
import { fetchAllowedStatuses } from '@/hooks/issues'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Avatar } from '../atoms/Avatar'
import { Badge } from '../atoms/Badge'
import { IssueCard } from '../molecules/IssueCard'
import { useToast } from '../molecules/Toast'

const DROP_ID_SEPARATOR = '::'

const dropTargetId = (lane: string, columnId: string) => `${lane}${DROP_ID_SEPARATOR}${columnId}`
const columnIdFromDropTarget = (dropId: string | number) => String(dropId).split(DROP_ID_SEPARATOR)[1]

// Lanes sorted by assignee name, with the "no assignee" lane always last.
function assigneeLanes(issues: Issue[], laneOf: (issue: Issue) => string, noAssignee: string): string[] {
    const names = [...new Set(issues.map(laneOf))]
    return names.sort((left, right) => {
        if (left === noAssignee) return 1
        if (right === noAssignee) return -1
        return left.localeCompare(right)
    })
}

/**
 * When a drag starts, fetches the statuses allowed by the Redmine workflow and dims the columns
 * the issue cannot be moved to.
 */
export function KanbanBoard({
    board,
    issues,
    loading,
    onOpen
}: {
    board: Board
    issues: Issue[]
    loading: boolean
    onOpen: (id: number) => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const queryClient = useQueryClient()
    const move = useMoveIssue(board.id)
    const [dragging, setDragging] = useState<Issue | null>(null)
    const [allowed, setAllowed] = useState<Set<number> | null>(null)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
    const noAssignee = t('board.noAssignee')
    const laneOf = useCallback((issue: Issue) => issue.assigned_to?.name ?? noAssignee, [noAssignee])
    const groupByAssignee = board.swimlanes === 'assignee'

    const lanes = useMemo(
        () => (groupByAssignee ? assigneeLanes(issues, laneOf, noAssignee) : ['']),
        [issues, groupByAssignee, laneOf, noAssignee]
    )
    const canDrop = (column: BoardColumn) => !dragging || canDropOn(column, dragging.status.id, allowed)
    const issuesIn = (column: BoardColumn) =>
        issues.filter((issue) => columnOf(board, issue.status.id)?.id === column.id)

    function onDragStart(event: DragStartEvent) {
        const issue = issues.find((candidate) => String(candidate.id) === event.active.id)
        if (!issue) return
        setDragging(issue)
        setAllowed(null)
        fetchAllowedStatuses(queryClient, issue)
            .then((statuses) => setAllowed(new Set(statuses.map((status) => status.id))))
            .catch(() => setAllowed(null))
    }

    async function onDragEnd(event: DragEndEvent) {
        const issue = dragging
        setDragging(null)
        setAllowed(null)
        if (!issue || !event.over) return
        const columnId = columnIdFromDropTarget(event.over.id)
        const column = board.columns.find((candidate) => candidate.id === columnId)
        if (!column || column.statusIds.includes(issue.status.id)) return
        try {
            const allowedStatuses = await fetchAllowedStatuses(queryClient, issue)
            const allowedIds = new Set(allowedStatuses.map((status) => status.id))
            const targetId = targetStatus(column, allowedIds)
            const optimistic = allowedStatuses.find((status) => status.id === targetId)
            const newStatus = await move.mutateAsync({ issueId: issue.id, columnId: column.id, optimistic })
            toast(t('board.moved', { id: issue.id, status: newStatus.name }))
        } catch (moveError) {
            toast(t('board.moveFailed', { id: issue.id, error: error(moveError) }), 'error')
        }
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <div className="flex-1 overflow-auto">
                <div className="inline-flex min-w-full flex-col">
                    <div className="sticky top-0 z-10 flex gap-3 bg-bg px-4 pb-2 pt-3">
                        {board.columns.map((column) => (
                            <ColumnHeader
                                key={column.id}
                                name={column.name}
                                count={issuesIn(column).length}
                                blocked={!canDrop(column)}
                            />
                        ))}
                    </div>

                    {loading && <div className="px-5 py-6 text-[13px] text-muted">{t('board.loading')}</div>}

                    {lanes.map((lane) => (
                        <div key={lane} className="flex flex-col">
                            {lane && <LaneHeader lane={lane} noAssignee={noAssignee} />}
                            <div className="flex gap-3 px-4 pb-3">
                                {board.columns.map((column) => {
                                    const laneIssues = issuesIn(column).filter(
                                        (issue) => !lane || laneOf(issue) === lane
                                    )
                                    return (
                                        <Column
                                            key={column.id}
                                            id={dropTargetId(lane, column.id)}
                                            disabled={!canDrop(column)}
                                            fill={!lane}
                                        >
                                            {laneIssues.map((issue) => (
                                                <DraggableCard
                                                    key={issue.id}
                                                    issue={issue}
                                                    onOpen={onOpen}
                                                    showStatus={column.statusIds.length > 1}
                                                />
                                            ))}
                                        </Column>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <DragOverlay dropAnimation={null}>
                {dragging && <IssueCard issue={dragging} overlay showStatus />}
            </DragOverlay>
        </DndContext>
    )
}

function ColumnHeader({ name, count, blocked }: { name: string; count: number; blocked: boolean }) {
    return (
        <div
            className={cn(
                'flex w-[280px] shrink-0 items-center gap-2 px-1 transition-opacity',
                blocked && 'opacity-40'
            )}
        >
            <span className="text-[12px] font-semibold uppercase tracking-wide">{name}</span>
            <Badge>{count}</Badge>
            {blocked && <Ban size={12} className="text-muted" />}
        </div>
    )
}

function LaneHeader({ lane, noAssignee }: { lane: string; noAssignee: string }) {
    const assigneeName = lane === noAssignee ? undefined : lane
    return (
        <div className="sticky left-0 flex items-center gap-2 px-5 pb-1 pt-3 text-[12px] font-medium text-muted">
            <Avatar name={assigneeName} />
            {lane}
        </div>
    )
}

function Column({
    id,
    disabled,
    fill,
    children
}: {
    id: string
    disabled: boolean
    fill: boolean
    children: ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({ id, disabled })
    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex w-[280px] shrink-0 flex-col gap-2 rounded-xl p-1.5 transition-colors',
                fill ? 'min-h-[calc(100vh-120px)]' : 'min-h-16',
                isOver && !disabled ? 'bg-accent-soft ring-1 ring-accent/40' : 'bg-panel-2/60',
                disabled && 'opacity-40'
            )}
        >
            {children}
        </div>
    )
}

function DraggableCard({
    issue,
    onOpen,
    showStatus
}: {
    issue: Issue
    onOpen: (id: number) => void
    showStatus: boolean
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(issue.id) })
    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={cn(isDragging && 'opacity-30')}
            onClick={() => onOpen(issue.id)}
        >
            <IssueCard issue={issue} showStatus={showStatus} />
        </div>
    )
}
