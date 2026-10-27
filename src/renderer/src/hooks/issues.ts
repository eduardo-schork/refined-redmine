import type { BulkChange, IssueNoteChange } from '@domain/redmine/issue-tree'
import { useMutation, useQuery, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query'
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
export const useLinkedIssues = (issueId: number, ids: number[], enabled = true) =>
    useQuery({
        queryKey: qk.linkedIssues(issueId, ids),
        enabled: enabled && ids.length > 0,
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

/**
 * The changed issues (with their related issues and tree) and, once, the boards and the queue that list them. Not the
 * nearby issues of a handoff left open after a failure: up to 60 reads, and they only help to pick the target.
 */
function refreshIssueViews(queryClient: QueryClient, ids: number[]) {
    const notNearby = (query: Query) => query.queryKey[2] !== 'nearby'
    for (const id of new Set(ids)) void queryClient.invalidateQueries({ queryKey: qk.issue(id), predicate: notNearby })
    void queryClient.invalidateQueries({ queryKey: qk.boardIssuesAll })
    void queryClient.invalidateQueries({ queryKey: qk.myQueue })
}

/**
 * For multi-step actions (bulk edit, trâmites): one refresh when every step ran, instead of reading the boards and
 * the issue tree again after each issue.
 */
export function useRefreshIssueViews() {
    const queryClient = useQueryClient()
    return (ids: number[]) => refreshIssueViews(queryClient, ids)
}

export function useChangeIssueStatus(id: number) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (statusId: number) => api.issues.changeStatus(id, statusId),
        onSuccess: () => refreshIssueViews(queryClient, [id])
    })
}

export function useCommentOnIssue(id: number) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (notes: string) => api.issues.comment(id, notes),
        onSuccess: () => refreshIssueViews(queryClient, [id])
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
            refreshIssueViews(queryClient, [id])
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

/** Only used by multi-step actions, which refresh the views once at the end (`useRefreshIssueViews`). */
export const useBulkEdit = () =>
    useMutation({
        mutationFn: ({ id, change }: { id: number; change: BulkChange }) => api.issues.bulkEdit(id, change)
    })

/** Issues around this one with their journals: targets and cited notes of a handoff. */
export const useNearbyIssues = (id: number, trackerIds: number[]) =>
    useQuery({
        queryKey: ['issue', id, 'nearby', trackerIds.join(',')],
        queryFn: () => api.issues.nearby(id, trackerIds),
        gcTime: 0
    })

/** `refreshViews: false` in multi-step actions, which refresh once at the end (`useRefreshIssueViews`). */
export function useCommentAndChange(refreshViews = true) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, change, uploads }: { id: number; change: IssueNoteChange; uploads: IssueUpload[] }) =>
            api.issues.commentAndChange(id, change, uploads),
        onSuccess: (_result, { id }) => {
            if (refreshViews) refreshIssueViews(queryClient, [id])
        }
    })
}
