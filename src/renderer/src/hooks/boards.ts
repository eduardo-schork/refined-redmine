import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BoardIssues, BoardNotifications } from '@contracts/api'
import type { Board } from '@domain/board/board'
import type { IssueStatus } from '@domain/redmine/entities'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

export const useBoardIssues = (boardId: string) =>
    useQuery({ queryKey: qk.boardIssues(boardId), queryFn: () => api.boards.issues(boardId), refetchInterval: 60_000 })

export function useSaveBoard() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ board, notifications }: { board: Board; notifications?: BoardNotifications }) =>
            api.boards.save(board, notifications),
        onSuccess: (session, { board }) => {
            queryClient.setQueryData(qk.session, session)
            void queryClient.invalidateQueries({ queryKey: qk.boardIssues(board.id) })
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
