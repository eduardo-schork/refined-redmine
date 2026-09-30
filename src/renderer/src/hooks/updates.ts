import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateStatus } from '@domain/update/release'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

export const useUpdateStatus = () => useQuery({ queryKey: qk.updateStatus, queryFn: () => api.updates.status() })

function useUpdateAction(action: () => Promise<UpdateStatus>) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: action,
        onSuccess: (status) => queryClient.setQueryData(qk.updateStatus, status)
    })
}

export const useCheckForUpdates = () => useUpdateAction(() => api.updates.check())
export const useDownloadUpdate = () => useUpdateAction(() => api.updates.download())

export function useSaveUpdateToken() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (token: string | null) => api.updates.setToken(token),
        onSuccess: (status) => queryClient.setQueryData(qk.updateStatus, status)
    })
}
