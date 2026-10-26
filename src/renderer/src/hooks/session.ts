import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { SettingsView } from '@contracts/api'
import type { Settings, SettingsPatch } from '@domain/settings/settings'
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

/** Settings backup to and from a JSON file (the main process opens the file dialogs). */
export function useBackup() {
    const queryClient = useQueryClient()
    const exportBackup = useMutation({ mutationFn: () => api.settings.exportBackup() })
    const importBackup = useMutation({
        mutationFn: () => api.settings.importBackup(),
        onSuccess: (session) => {
            if (!session) return
            queryClient.setQueryData(qk.session, session)
            void queryClient.invalidateQueries({ queryKey: qk.sprints })
            void queryClient.invalidateQueries({ queryKey: qk.boardIssuesAll })
        }
    })
    return { exportBackup, importBackup }
}

type SavedSection = 'appearance' | 'issueStyle'

/**
 * Saves part of a settings section. Each change starts from the latest value, including changes still being saved:
 * two quick changes in a row would otherwise both start from the same old value and the second would undo the first.
 */
export function useSaveSection<K extends SavedSection>(section: K) {
    const current = useSettings()[section]
    const update = useUpdateSettings()
    const latest = useRef(current)
    useEffect(() => {
        latest.current = current
    }, [current])
    return (change: (value: Settings[K]) => Partial<Settings[K]>) => {
        const next = { ...latest.current, ...change(latest.current) }
        latest.current = next
        update.mutate({ [section]: next })
    }
}

// A different account (or none) must not see the previous account's cached data.
function replaceSession(queryClient: QueryClient, session: SettingsView) {
    // Not queryClient.clear(): it would also drop the session entry the app is watching, and the screen would keep
    // showing the old session (e.g. the connection screen after a successful login) until something re-rendered it.
    const isSession = (queryKey: readonly unknown[]) => queryKey[0] === qk.session[0]
    queryClient.removeQueries({ predicate: (query) => !isSession(query.queryKey) })
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
