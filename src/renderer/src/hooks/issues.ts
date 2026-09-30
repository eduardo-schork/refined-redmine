import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Issue } from '@domain/redmine/entities'
import type { IssueFieldsChange } from '@domain/redmine/issue-edit'
import { MY_OPEN_QUEUE } from '@domain/redmine/issue-filter'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

export const useIssue = (id: number) => useQuery({ queryKey: qk.issue(id), queryFn: () => api.issues.get(id) })

export const useIssueTitle = (id?: number) =>
    useQuery({
        queryKey: qk.issueTitle(id ?? 0),
        enabled: Boolean(id),
        queryFn: () => api.issues.get(id!),
        retry: false
    })

/** My open issues (Home, calendar). */
export const useMyQueue = (enabled = true) =>
    useQuery({
        queryKey: qk.myQueue,
        enabled,
        queryFn: () => api.issues.list(MY_OPEN_QUEUE, 500),
        refetchInterval: 120_000
    })

export const useVersionIssues = (versionId: number) =>
    useQuery({
        queryKey: qk.versionIssues(versionId),
        queryFn: () => api.issues.list({ versionId, status: '*', sort: 'priority' }, 500)
    })

/** Statuses allowed by the Redmine workflow for an issue (short cache). */
export function fetchAllowedStatuses(queryClient: QueryClient, issue: Issue) {
    return queryClient.fetchQuery({
        queryKey: qk.allowed(issue.id, issue.updated_on),
        queryFn: () => api.issues.allowedStatuses(issue.id),
        staleTime: 60_000
    })
}

function invalidateIssueViews(queryClient: QueryClient, id: number) {
    void queryClient.invalidateQueries({ queryKey: qk.issue(id) })
    void queryClient.invalidateQueries({ queryKey: qk.boardIssuesAll })
    void queryClient.invalidateQueries({ queryKey: qk.myQueue })
}

export function useChangeIssueStatus(id: number) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (statusId: number) => api.issues.changeStatus(id, statusId),
        onSuccess: () => invalidateIssueViews(queryClient, id)
    })
}

export function useCommentOnIssue(id: number) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (notes: string) => api.issues.comment(id, notes),
        onSuccess: () => invalidateIssueViews(queryClient, id)
    })
}

export const useIssueSearch = (input: string) =>
    useQuery({
        queryKey: qk.issueSearch(input),
        queryFn: () => api.issues.search(input),
        enabled: input.trim().length > 0,
        staleTime: 30_000,
        placeholderData: (previous) => previous
    })

export const useIssueEditOptions = (projectId: number) =>
    useQuery({
        queryKey: qk.issueEditOptions(projectId),
        queryFn: () => api.issues.editOptions(projectId),
        staleTime: 5 * 60_000
    })

export function useEditIssue(id: number) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (change: IssueFieldsChange) => api.issues.edit(id, change),
        onSuccess: (result) => {
            queryClient.setQueryData(qk.issue(id), result.issue)
            invalidateIssueViews(queryClient, id)
        }
    })
}
