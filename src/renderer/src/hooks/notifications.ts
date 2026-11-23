import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppNotification } from '@domain/notification/notification'
import { api, onAppEvent } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { parseIssueRoute, parseRoute, type Route } from '@/lib/router'

export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list() })
export const useMonitorStatus = () => useQuery({ queryKey: qk.monitorStatus, queryFn: () => api.monitor.status() })
/** Related issues in a status a monitor waits for (read again after each monitor cycle). */
export const useRelatedMarks = () => useQuery({ queryKey: qk.relatedMarks, queryFn: () => api.monitor.relatedMarks() })
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

export function useMarkUnread() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (ids: string[]) => api.notifications.markUnread(ids),
        onSuccess: (items) => queryClient.setQueryData(qk.notifications, items)
    })
}

export function useRemoveNotifications() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (ids: string[]) => api.notifications.remove(ids),
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
export function useAppEventsSync(onNavigate: (route: Route) => void, onOpenIssue: (id: number, note?: number) => void) {
    const queryClient = useQueryClient()
    useEffect(() => {
        const followRoute = (path: string) => {
            const issue = parseIssueRoute(path)
            if (issue) {
                onOpenIssue(issue.id, issue.note)
                return
            }
            const route = parseRoute(path)
            if (route) onNavigate(route)
        }
        const unsubscribers = [
            onAppEvent('notifications.changed', (items) => queryClient.setQueryData(qk.notifications, items)),
            onAppEvent('monitor.status', (status) => {
                queryClient.setQueryData(qk.monitorStatus, status)
                void queryClient.invalidateQueries({ queryKey: qk.relatedMarks })
            }),
            onAppEvent('permission.changed', (info) => queryClient.setQueryData(qk.permission, info)),
            onAppEvent('update.status', (status) => queryClient.setQueryData(qk.updateStatus, status)),
            onAppEvent('timer.status', (timer) => queryClient.setQueryData(qk.timer, timer)),
            onAppEvent('navigate', followRoute)
        ]
        // A route that arrived while the screen was loading (the app opened by a link or a notification).
        void api.app.takePendingRoute().then((path) => {
            if (path) followRoute(path)
        })
        return () => {
            for (const unsubscribe of unsubscribers) unsubscribe()
        }
    }, [queryClient, onNavigate, onOpenIssue])
}
