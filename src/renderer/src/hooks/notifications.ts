import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppNotification } from '@domain/notification/notification'
import { api, onAppEvent } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { parseIssueRoute, parseRoute, type Route } from '@/lib/router'

export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list() })
export const useMonitorStatus = () => useQuery({ queryKey: qk.monitorStatus, queryFn: () => api.monitor.status() })
export const usePermission = () => useQuery({ queryKey: qk.permission, queryFn: () => api.notifications.permission() })

export const unreadCount = (items?: AppNotification[]) =>
    (items ?? []).filter((notification) => !notification.read).length

export function useMarkRead() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (ids: string[] | 'all') => api.notifications.markRead(ids),
        onSuccess: (items) => queryClient.setQueryData(qk.notifications, items)
    })
}

export function useClearNotifications() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => api.notifications.clear(),
        onSuccess: (items) => queryClient.setQueryData(qk.notifications, items)
    })
}

export function useRunMonitorNow() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => api.monitor.runNow(),
        onSuccess: (status) => queryClient.setQueryData(qk.monitorStatus, status)
    })
}

/** Keeps the cache in sync with events pushed by the main process. */
export function useAppEventsSync(onNavigate: (route: Route) => void, onOpenIssue: (id: number) => void) {
    const queryClient = useQueryClient()
    useEffect(() => {
        const unsubscribers = [
            onAppEvent('notifications.changed', (items) => queryClient.setQueryData(qk.notifications, items)),
            onAppEvent('monitor.status', (status) => queryClient.setQueryData(qk.monitorStatus, status)),
            onAppEvent('permission.changed', (info) => queryClient.setQueryData(qk.permission, info)),
            onAppEvent('update.status', (status) => queryClient.setQueryData(qk.updateStatus, status)),
            onAppEvent('timer.status', (timer) => queryClient.setQueryData(qk.timer, timer)),
            onAppEvent('navigate', (path) => {
                const issueId = parseIssueRoute(path)
                if (issueId) {
                    onOpenIssue(issueId)
                    return
                }
                const route = parseRoute(path)
                if (route) onNavigate(route)
            })
        ]
        return () => {
            for (const unsubscribe of unsubscribers) unsubscribe()
        }
    }, [queryClient, onNavigate, onOpenIssue])
}
