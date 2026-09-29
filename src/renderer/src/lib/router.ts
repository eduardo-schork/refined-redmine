import { createContext, useContext } from 'react'
import type { NotificationTarget } from '@domain/notification/notification'

export const SETTINGS_TABS = ['general', 'appearance', 'notifications', 'calendar', 'work'] as const
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
    | { page: 'settings'; tab?: SettingsTab }

const PARAMETERLESS_PAGES = ['notifications', 'log', 'sprints', 'home'] as const
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

export const NavContext = createContext<(route: Route) => void>(() => {})
export const useNavigate = () => useContext(NavContext)

/** Opens a notification target: an internal route navigates in the app; a URL goes to the browser. */
export function openTarget(
    target: NotificationTarget,
    navigate: (route: Route) => void,
    openExternal: (url: string) => void
): void {
    if (target.type !== 'route') {
        openExternal(target.url)
        return
    }
    const route = parseRoute(target.route)
    if (route) navigate(route)
}
