import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { LocalDate } from '@domain/shared/date'
import type { TimeEntryDraft } from '@domain/time/time-entry'
import type { TimerState } from '@domain/time/timer'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

const DAY_MS = 24 * 60 * 60 * 1000

export const useTimeActivities = () =>
    useQuery({ queryKey: qk.timeActivities, queryFn: () => api.reference.timeActivities(), staleTime: DAY_MS })

export const useIssueTime = (issueId: number) =>
    useQuery({ queryKey: qk.issueTime(issueId), queryFn: () => api.time.forIssue(issueId) })

export const useMyTime = (from: LocalDate, to: LocalDate) =>
    useQuery({ queryKey: qk.myTime(from, to), queryFn: () => api.time.mine(from, to) })

/** One listing per person: kept for a minute so switching periods back and forth does not repeat them. */
export const useTeamTime = (memberIds: number[], from: LocalDate, to: LocalDate) =>
    useQuery({
        queryKey: qk.teamTime(memberIds, from, to),
        queryFn: () => api.time.team(memberIds, from, to),
        enabled: memberIds.length > 0,
        staleTime: 60_000
    })

/** A logged hour changes the entries, the "spent" of the issue and the home tile. */
function invalidateTimeViews(queryClient: QueryClient, issueId?: number) {
    void queryClient.invalidateQueries({ queryKey: qk.time })
    if (issueId) void queryClient.invalidateQueries({ queryKey: qk.issue(issueId) })
}

export function useLogTime() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (draft: TimeEntryDraft) => api.time.log(draft),
        onSuccess: (_entry, draft) => invalidateTimeViews(queryClient, draft.issueId)
    })
}

export function useEditTime() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, draft }: { id: number; draft: TimeEntryDraft }) => api.time.edit(id, draft),
        onSuccess: (_result, { draft }) => invalidateTimeViews(queryClient, draft.issueId)
    })
}

export function useDeleteTime() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id }: { id: number; issueId?: number }) => api.time.remove(id),
        onSuccess: (_result, { issueId }) => invalidateTimeViews(queryClient, issueId)
    })
}

export function useRepeatWeek() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ from, to }: { from: LocalDate; to: LocalDate }) => api.time.repeatWeek(from, to),
        onSuccess: () => invalidateTimeViews(queryClient)
    })
}

/** The stopwatch lives in the main process; changes arrive through the "timer.status" event too. */
export const useTimer = () => useQuery({ queryKey: qk.timer, queryFn: () => api.timer.status(), staleTime: Infinity })

export function useTimerActions() {
    const queryClient = useQueryClient()
    const apply = (timer: TimerState | null) => queryClient.setQueryData(qk.timer, timer)
    const start = useMutation({
        mutationFn: (issue: { id: number; subject: string }) => api.timer.start(issue),
        onSuccess: apply
    })
    const pause = useMutation({ mutationFn: () => api.timer.pause(), onSuccess: apply })
    const resume = useMutation({ mutationFn: () => api.timer.resume(), onSuccess: apply })
    const discard = useMutation({ mutationFn: () => api.timer.discard(), onSuccess: apply })
    // Stopping pauses: the stopwatch only goes away once the time is logged (or discarded).
    const stop = useMutation({
        mutationFn: () => api.timer.stop(),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.timer })
    })
    return { start, pause, resume, discard, stop }
}
