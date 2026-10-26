import type { BulkChange, IssueNoteChange } from '@domain/redmine/issue-tree'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Issue } from '@domain/redmine/entities'
import type { IssueFieldsChange, NewIssue } from '@domain/redmine/issue-edit'
import { MY_OPEN_QUEUE } from '@domain/redmine/issue-filter'
import type { IssueUpload } from '@domain/redmine/issue-upload'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

/** The full issue (journals, attachments, relations): also loaded ahead with `queryClient.fetchQuery`. */
export const issueQuery = (id: number) => ({ queryKey: qk.issue(id), queryFn: () => api.issues.get(id) })

export const useIssue = (id: number, enabled = true) => useQuery({ ...issueQuery(id), enabled })

/** Subtasks and related issues of `issueId`, by number. */
export const useLinkedIssues = (issueId: number, ids: number[]) =>
    useQuery({
        queryKey: qk.linkedIssues(issueId, ids),
        enabled: ids.length > 0,
        queryFn: () => api.issues.byIds(ids),
        select: (issues) => new Map(issues.map((issue) => [issue.id, issue]))
    })

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

export const useIssueEditOptions = (projectId: number, enabled = true) =>
    useQuery({
        queryKey: qk.issueEditOptions(projectId),
        enabled,
        queryFn: () => api.issues.editOptions(projectId),
        staleTime: 5 * 60_000
    })

/** Learned from the project's last 100 issues; not read again while cached. */
export const useIssueCustomFields = (projectId: number, enabled = true) =>
    useQuery({
        queryKey: qk.issueCustomFields(projectId),
        enabled,
        queryFn: () => api.issues.customFields(projectId),
        staleTime: Infinity
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

/** A subtask also refreshes its parent, which lists it. */
export function useCreateIssue() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ issue, uploads }: { issue: NewIssue; uploads: IssueUpload[] }) =>
            api.issues.create(issue, uploads),
        onSuccess: (_created, { issue }) => {
            void queryClient.invalidateQueries({ queryKey: qk.boardIssuesAll })
            void queryClient.invalidateQueries({ queryKey: qk.myQueue })
            if (issue.parentIssueId) void queryClient.invalidateQueries({ queryKey: qk.issue(issue.parentIssueId) })
        }
    })
}

/** Read when the bulk edit opens; not kept, because the point is to change it. */
export const useIssueTree = (id: number, enabled = true) =>
    useQuery({ queryKey: qk.issueTree(id), queryFn: () => api.issues.tree(id), gcTime: 0, enabled })

export function useBulkEdit() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, change }: { id: number; change: BulkChange }) => api.issues.bulkEdit(id, change),
        onSuccess: (_result, { id }) => invalidateIssueViews(queryClient, id)
    })
}

/** Issues around this one with their journals: targets and cited notes of a handoff. */
export const useNearbyIssues = (id: number, trackerIds: number[]) =>
    useQuery({
        queryKey: ['issue', id, 'nearby', trackerIds.join(',')],
        queryFn: () => api.issues.nearby(id, trackerIds),
        gcTime: 0
    })

export function useCommentAndChange() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, change, uploads }: { id: number; change: IssueNoteChange; uploads: IssueUpload[] }) =>
            api.issues.commentAndChange(id, change, uploads),
        onSuccess: (_result, { id }) => invalidateIssueViews(queryClient, id)
    })
}
