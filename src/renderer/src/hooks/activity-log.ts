import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

const REFRESH_MS = 5_000

export const useActivityLog = () =>
    useQuery({ queryKey: qk.activityLog, queryFn: () => api.log.list(), refetchInterval: REFRESH_MS })

export function useClearActivityLog() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => api.log.clear(),
        onSuccess: () => queryClient.setQueryData(qk.activityLog, [])
    })
}
