import { createContext, useContext } from 'react'
import { parseRoute, type Route } from './router'

/** One open screen. `key` is unique; a screen opened twice ("Duplicate") gets `<screen>#2`, `#3`… */
export interface WorkspaceTab {
    key: string
    route: Route
    /** Issues open in this tab's modal, oldest first: the last one is shown and "← back" returns to the previous. */
    issues?: number[]
}

export interface WorkspaceTabs {
    tabs: WorkspaceTab[]
    /** Undefined when every tab was closed. */
    activeKey?: string
}

const STORAGE_KEY = 'refined-redmine.workspace-tabs'

/** Calendar dates and settings sections are places inside the same tab; each board is a tab of its own. */
export function tabKey(route: Route): string {
    if (route.page === 'board') return `board:${route.boardId ?? ''}`
    return route.page
}

/**
 * Brings the screen's tab to the front (the first one, when it was duplicated), opening it at the end when it is
 * not open; an open one takes the new route.
 */
export function openTab(state: WorkspaceTabs, route: Route): WorkspaceTabs {
    const screen = tabKey(route)
    const open = state.tabs.find((tab) => tabKey(tab.route) === screen)
    if (!open) return openNewTab(state, route)
    const tabs = state.tabs.map((tab) => (tab === open ? { ...tab, route } : tab))
    return { tabs, activeKey: open.key }
}

function unusedKey(state: WorkspaceTabs, screen: string): string {
    const used = new Set(state.tabs.map((tab) => tab.key))
    let copy = 1
    let key = screen
    while (used.has(key)) {
        copy += 1
        key = `${screen}#${copy}`
    }
    return key
}

/** ⌘-click or middle click in the menu, and "Duplicate": always a new tab, at the end. */
export function openNewTab(state: WorkspaceTabs, route: Route): WorkspaceTabs {
    const key = unusedKey(state, tabKey(route))
    return { tabs: [...state.tabs, { key, route }], activeKey: key }
}

/** Dragging a tab onto another puts it in that one's place. */
export function moveTab(state: WorkspaceTabs, fromKey: string, toKey: string): WorkspaceTabs {
    const moving = state.tabs.find((tab) => tab.key === fromKey)
    const targetIndex = state.tabs.findIndex((tab) => tab.key === toKey)
    if (!moving || targetIndex < 0 || fromKey === toKey) return state
    const others = state.tabs.filter((tab) => tab.key !== fromKey)
    const tabs = [...others.slice(0, targetIndex), moving, ...others.slice(targetIndex)]
    return { ...state, tabs }
}

export function closeOtherTabs(state: WorkspaceTabs, key: string): WorkspaceTabs {
    const kept = state.tabs.filter((tab) => tab.key === key)
    return kept.length ? { tabs: kept, activeKey: key } : state
}

/** Without tabs, every navigation replaces the only screen. */
export function replaceTab(route: Route): WorkspaceTabs {
    const key = tabKey(route)
    return { tabs: [{ key, route }], activeKey: key }
}

/** Closing the tab in front shows the next one, or the previous one when it was the last. */
export function closeTab(state: WorkspaceTabs, key: string): WorkspaceTabs {
    const index = state.tabs.findIndex((tab) => tab.key === key)
    if (index < 0) return state
    const tabs = state.tabs.filter((tab) => tab.key !== key)
    if (state.activeKey !== key) return { tabs, activeKey: state.activeKey }
    const neighbour = tabs[Math.min(index, tabs.length - 1)]
    return { tabs, activeKey: neighbour?.key }
}

/** Ctrl+Tab and Ctrl+Shift+Tab: the next or previous tab, wrapping around. */
export function stepTab(state: WorkspaceTabs, step: number): WorkspaceTabs {
    const count = state.tabs.length
    if (count === 0) return state
    const current = state.tabs.findIndex((tab) => tab.key === state.activeKey)
    const next = (current + step + count) % count
    return { ...state, activeKey: state.tabs[next].key }
}

/** ⌘1…⌘9: that tab by position; ⌘9 is always the last one, as in browsers. */
export function tabAt(state: WorkspaceTabs, position: number): WorkspaceTabs {
    const lastPosition = 9
    const index = position === lastPosition ? state.tabs.length - 1 : position - 1
    const tab = state.tabs[index]
    return tab ? { ...state, activeKey: tab.key } : state
}

/** Drops tabs whose screen no longer exists (a deleted board). */
export function keepTabs(state: WorkspaceTabs, exists: (route: Route) => boolean): WorkspaceTabs {
    const tabs = state.tabs.filter((tab) => exists(tab.route))
    if (tabs.length === state.tabs.length) return state
    const activeStillOpen = tabs.some((tab) => tab.key === state.activeKey)
    return activeStillOpen ? { tabs, activeKey: state.activeKey } : { tabs, activeKey: tabs[0]?.key }
}

function changeIssues(state: WorkspaceTabs, key: string, change: (issues: number[]) => number[]): WorkspaceTabs {
    const tabs = state.tabs.map((tab) => (tab.key === key ? { ...tab, issues: change(tab.issues ?? []) } : tab))
    return { ...state, tabs }
}

/** Opens an issue in the tab's modal, on top of the ones already open there (unless it is already on top). */
export function pushIssue(state: WorkspaceTabs, key: string, issueId: number): WorkspaceTabs {
    return changeIssues(state, key, (issues) => (issues.at(-1) === issueId ? issues : [...issues, issueId]))
}

/** "← back" or closing the modal: the previous issue of that tab shows again, or the modal closes. */
export function popIssue(state: WorkspaceTabs, key: string): WorkspaceTabs {
    return changeIssues(state, key, (issues) => issues.slice(0, -1))
}

export const activeRoute = (state: WorkspaceTabs): Route | undefined =>
    state.tabs.find((tab) => tab.key === state.activeKey)?.route

/** The text form of a route, read back by parseRoute. */
export function routePath(route: Route): string {
    switch (route.page) {
        case 'board':
            return route.boardId ? `/board?id=${encodeURIComponent(route.boardId)}` : '/board'
        case 'settings':
            return route.tab ? `/settings?tab=${route.tab}` : '/settings'
        case 'calendar':
            // A date or event is where the calendar was sent once; reopening starts on today.
            return '/calendar'
        default:
            return `/${route.page}`
    }
}

interface StoredTabs {
    paths: string[]
    activeIndex?: number
    /** Each tab's open issues, in the order of `paths`. */
    issues?: number[][]
}

function storedIssues(value: unknown): number[] {
    if (!Array.isArray(value)) return []
    return value.filter((issueId): issueId is number => Number.isInteger(issueId) && issueId > 0)
}

interface RestorableTab {
    route: Route
    issues: number[]
}

function restorableTabs(stored: StoredTabs): RestorableTab[] {
    return stored.paths.flatMap((path, index) => {
        const route = parseRoute(String(path))
        return route ? [{ route, issues: storedIssues(stored.issues?.[index]) }] : []
    })
}

function restoreTab(state: WorkspaceTabs, { route, issues }: RestorableTab): WorkspaceTabs {
    const key = unusedKey(state, tabKey(route))
    return { tabs: [...state.tabs, { key, route, issues }], activeKey: key }
}

/** Tabs of the last session on this computer, with the issues open in each; anything unreadable is left out. */
export function loadTabs(): WorkspaceTabs | undefined {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredTabs | null
        if (!stored || !Array.isArray(stored.paths)) return undefined
        const tabs = restorableTabs(stored)
        if (!tabs.length) return undefined
        const restored = tabs.reduce<WorkspaceTabs>(restoreTab, { tabs: [] })
        const active = restored.tabs[Number(stored.activeIndex)] ?? restored.tabs[0]
        return { ...restored, activeKey: active.key }
    } catch {
        return undefined
    }
}

export function saveTabs(state: WorkspaceTabs): void {
    const paths = state.tabs.map((tab) => routePath(tab.route))
    const issues = state.tabs.map((tab) => tab.issues ?? [])
    const activeIndex = state.tabs.findIndex((tab) => tab.key === state.activeKey)
    const stored: StoredTabs = { paths, activeIndex, issues }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
        // Storage may be unavailable; the tabs simply start fresh next time.
    }
}

/** False inside a hidden tab: its screen keeps its state but must not react to the keyboard. */
export const ActiveTabContext = createContext(true)
export const useIsActiveTab = () => useContext(ActiveTabContext)
