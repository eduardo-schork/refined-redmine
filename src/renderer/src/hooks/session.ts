import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { SettingsView } from '@contracts/api'
import type { SettingsPatch } from '@domain/settings/settings'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

export function useSession() {
    return useQuery({ queryKey: qk.session, queryFn: () => api.session.get(), staleTime: Infinity })
}

/** Already loaded session (use inside the authenticated app). */
export function useSettings(): SettingsView {
    const { data } = useSession()
    if (!data) throw new Error('Session not loaded yet')
    return data
}

export function useUpdateSettings() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (patch: SettingsPatch) => api.settings.update(patch),
        onSuccess: (session, patch) => {
            queryClient.setQueryData(qk.session, session)
            // Sprint conventions change the classification and the sprint boards.
            if (patch.sprints) {
                void queryClient.invalidateQueries({ queryKey: qk.sprints })
                void queryClient.invalidateQueries({ queryKey: qk.boardIssuesAll })
            }
        }
    })
}

// A different account (or none) must not see the previous account's cached data.
function replaceSession(queryClient: QueryClient, session: SettingsView) {
    queryClient.clear()
    queryClient.setQueryData(qk.session, session)
}

export function useLogin() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) => api.session.login(baseUrl, apiKey),
        onSuccess: (session) => replaceSession(queryClient, session)
    })
}

export function useLogout() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => api.session.logout(),
        onSuccess: (session) => replaceSession(queryClient, session)
    })
}
