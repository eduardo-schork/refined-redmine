import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { BoardIssues, BoardNotifications } from '@contracts/api'
import type { Board } from '@domain/board/board'
import { createAgileBoard, isCompleteSource } from '@domain/board/board-rules'
import type { IssueStatus } from '@domain/redmine/entities'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { localId } from '@/lib/ids'
import { qk } from '@/lib/query-keys'
import { useStatuses } from './reference'
import { useSettings, useUpdateSettings } from './session'

/** The open board's total also goes to the sidebar count: it follows every reload, automatic or by Atualizar. */
async function loadBoardIssues(queryClient: QueryClient, boardId: string): Promise<BoardIssues> {
    const boardIssues = await api.boards.issues(boardId)
    const total = boardIssues.unresolvedSprint ? null : boardIssues.issues.total
    queryClient.setQueryData(qk.boardCount(boardId), total)
    return boardIssues
}

export function useBoardIssues(boardId: string) {
    const queryClient = useQueryClient()
    return useQuery({
        queryKey: qk.boardIssues(boardId),
        queryFn: () => loadBoardIssues(queryClient, boardId),
        refetchInterval: 60_000
    })
}

/** Total issues of a board's source, for the sidebar; read again at each automatic check interval. */
export function useBoardCount(boardId: string) {
    const { pollSeconds } = useSettings()
    return useQuery({
        queryKey: qk.boardCount(boardId),
        queryFn: () => api.boards.count(boardId),
        refetchInterval: pollSeconds * 1000
    })
}

export function useSaveBoard() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ board, notifications }: { board: Board; notifications?: BoardNotifications }) =>
            api.boards.save(board, notifications),
        onSuccess: (session, { board }) => {
            queryClient.setQueryData(qk.session, session)
            void queryClient.invalidateQueries({ queryKey: qk.boardIssues(board.id) })
            void queryClient.invalidateQueries({ queryKey: qk.boardCount(board.id) })
        }
    })
}

export function useDeleteBoard() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (boardId: string) => api.boards.remove(boardId),
        onSuccess: (session) => queryClient.setQueryData(qk.session, session)
    })
}

type MoveIssueCommand = { issueId: number; columnId: string; optimistic?: IssueStatus }

function withIssueStatus(boardIssues: BoardIssues, issueId: number, status: IssueStatus): BoardIssues {
    const items = boardIssues.issues.items.map((issue) => (issue.id === issueId ? { ...issue, status } : issue))
    return { ...boardIssues, issues: { ...boardIssues.issues, items } }
}

/** Moves a card with an optimistic update; rolls back if Redmine rejects it. */
export function useMoveIssue(boardId: string) {
    const queryClient = useQueryClient()
    const key = qk.boardIssues(boardId)
    return useMutation({
        mutationFn: (command: MoveIssueCommand) => api.boards.move(boardId, command.issueId, command.columnId),
        onMutate: async (command) => {
            await queryClient.cancelQueries({ queryKey: key })
            const previous = queryClient.getQueryData<BoardIssues>(key)
            if (command.optimistic && previous) {
                queryClient.setQueryData(key, withIssueStatus(previous, command.issueId, command.optimistic))
            }
            return { previous }
        },
        onError: (_error, _command, context) => {
            if (context?.previous) {
                queryClient.setQueryData(key, context.previous)
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: key })
        }
    })
}

/** Statuses and number of issues of a board being created, to suggest its columns (only with a complete source). */
export function useColumnSuggestion(board: Board) {
    return useQuery({
        queryKey: ['board-column-suggestion', JSON.stringify(board.source)],
        queryFn: () => api.boards.suggestColumns({ ...board, columns: [] }),
        enabled: isCompleteSource(board.source),
        staleTime: 60_000
    })
}

/** Puts the "Ágil" board first in the list, once per user (also for those who already have boards). */
export function useSeedAgileBoard() {
    const { t } = useI18n()
    const settings = useSettings()
    const statuses = useStatuses().data
    const updateSettings = useUpdateSettings()
    const seeding = useRef(false)
    const mustSeed = !settings.agileBoardSeeded && Boolean(statuses?.length)

    useEffect(() => {
        if (!mustSeed || !statuses || seeding.current) return
        seeding.current = true
        const agile = createAgileBoard(statuses, localId(), t('board.agile'))
        updateSettings.mutate({ boards: [agile, ...settings.boards], agileBoardSeeded: true })
    }, [mustSeed, statuses, settings.boards, updateSettings, t])
}
