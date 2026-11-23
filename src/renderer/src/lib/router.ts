import { createContext, useContext } from 'react'
import type { AppNotification } from '@domain/notification/notification'

export const SETTINGS_TABS = [
    'general',
    'appearance',
    'notifications',
    'calendar',
    'work',
    'automations',
    'backup'
] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

function settingsTab(value: string | null): SettingsTab | undefined {
    return SETTINGS_TABS.find((tab) => tab === value)
}

export type Route =
    | { page: 'home' }
    | { page: 'sprints' }
    | { page: 'calendar'; date?: string; eventId?: string }
    | { page: 'board'; boardId?: string }
    | { page: 'notifications' }
    | { page: 'log' }
    | { page: 'time' }
    | { page: 'overtime' }
    | { page: 'team' }
    | { page: 'monitors' }
    | { page: 'settings'; tab?: SettingsTab }

const PARAMETERLESS_PAGES = ['notifications', 'log', 'sprints', 'home', 'time', 'overtime', 'team', 'monitors'] as const
type ParameterlessPage = (typeof PARAMETERLESS_PAGES)[number]

const isParameterlessPage = (page: string): page is ParameterlessPage =>
    (PARAMETERLESS_PAGES as readonly string[]).includes(page)

/** Converts text routes (from the main process or notifications) into a Route. */
export function parseRoute(path: string): Route | null {
    const url = new URL(path, 'app://local')
    const page = url.pathname.replace(/^\//, '')
    if (page === 'calendar') {
        return {
            page: 'calendar',
            date: url.searchParams.get('date') ?? undefined,
            eventId: url.searchParams.get('event') ?? undefined
        }
    }
    if (page === 'settings') return { page: 'settings', tab: settingsTab(url.searchParams.get('tab')) }
    if (page === 'board') return { page: 'board', boardId: url.searchParams.get('id') ?? undefined }
    if (isParameterlessPage(page)) return { page }
    return null
}

/** `newTab`: open another tab even when the screen is already open (⌘-click or middle click in the menu). */
export interface NavigateOptions {
    newTab?: boolean
}

export const NavContext = createContext<(route: Route, options?: NavigateOptions) => void>(() => {})
export const useNavigate = () => useContext(NavContext)

const positiveInteger = (value: string | null) => {
    const number = Number(value)
    return Number.isInteger(number) && number > 0 ? number : undefined
}

/**
 * The issue (and note) of an `/issue?id=1234&note=5` route (a click on a system notification, a refined-redmine://
 * link), or undefined for other routes.
 */
export function parseIssueRoute(path: string): { id: number; note?: number } | undefined {
    const url = new URL(path, 'app://local')
    if (url.pathname !== '/issue') return undefined
    const id = positiveInteger(url.searchParams.get('id'))
    if (!id) return undefined
    return { id, note: positiveInteger(url.searchParams.get('note')) }
}

interface NotificationOpeners {
    navigate: (route: Route) => void
    openIssue: (id: number) => void
    openExternal: (url: string) => void
}

/** A notification about an issue opens it in the app; the others go to their route, or to the browser. */
export function openNotification(notification: AppNotification, openers: NotificationOpeners): void {
    if (notification.issueId) {
        openers.openIssue(notification.issueId)
        return
    }
    const { target } = notification
    if (target.type !== 'route') {
        openers.openExternal(target.url)
        return
    }
    const route = parseRoute(target.route)
    if (route) openers.navigate(route)
}
