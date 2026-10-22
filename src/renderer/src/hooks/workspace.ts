import { useCallback, useEffect, useState } from 'react'
import type { Board } from '@domain/board/board'
import type { WorkspacePreferences } from '@domain/settings/settings'
import type { NavigateOptions, Route } from '@/lib/router'
import {
    activeRoute,
    closeOtherTabs,
    closeTab,
    keepTabs,
    loadTabs,
    moveTab,
    openNewTab,
    openTab,
    replaceTab,
    saveTabs,
    stepTab,
    tabAt,
    type WorkspaceTabs
} from '@/lib/workspace-tabs'

const HOME: Route = { page: 'home' }

/** "Boards" without a board means the first one: named here, so it shares that board's tab. */
function withBoard(route: Route, boards: Board[]): Route {
    if (route.page !== 'board' || route.boardId) return route
    return boards[0] ? { page: 'board', boardId: boards[0].id } : route
}

function boardExists(boards: Board[]) {
    const ids = new Set(boards.map((board) => board.id))
    return (route: Route) => route.page !== 'board' || !route.boardId || ids.has(route.boardId)
}

function initialTabs(preferences: WorkspacePreferences): WorkspaceTabs {
    const restored = preferences.tabs && preferences.restoreTabs ? loadTabs() : undefined
    return restored ?? replaceTab(HOME)
}

/**
 * The open screens. With tabs on, each screen or board opens in its own tab (or brings it to the front); with
 * tabs off, a navigation replaces the only screen, as before tabs existed.
 */
export function useWorkspaceTabs(preferences: WorkspacePreferences, boards: Board[]) {
    const [stored, setStored] = useState(() => initialTabs(preferences))
    const current = keepTabs(stored, boardExists(boards))
    const visible = preferences.tabs ? current : replaceTab(activeRoute(current) ?? HOME)

    const update = useCallback(
        (change: (state: WorkspaceTabs) => WorkspaceTabs) =>
            setStored((state) => change(keepTabs(state, boardExists(boards)))),
        [boards]
    )

    useEffect(() => {
        if (preferences.tabs && preferences.restoreTabs) saveTabs(current)
    }, [current, preferences.tabs, preferences.restoreTabs])

    const navigate = useCallback(
        (route: Route, options: NavigateOptions = {}) => {
            const target = withBoard(route, boards)
            update((state) => {
                if (!preferences.tabs) return replaceTab(target)
                return options.newTab ? openNewTab(state, target) : openTab(state, target)
            })
        },
        [boards, preferences.tabs, update]
    )
    const duplicate = (key: string) =>
        update((state) => {
            const tab = state.tabs.find((candidate) => candidate.key === key)
            return tab ? openNewTab(state, tab.route) : state
        })

    return {
        tabs: visible.tabs,
        activeKey: visible.activeKey,
        activeRoute: activeRoute(visible),
        enabled: preferences.tabs,
        navigate,
        select: (key: string) => update((state) => ({ ...state, activeKey: key })),
        close: (key: string) => update((state) => closeTab(state, key)),
        closeOthers: (key: string) => update((state) => closeOtherTabs(state, key)),
        move: (fromKey: string, toKey: string) => update((state) => moveTab(state, fromKey, toKey)),
        duplicate,
        step: (step: number) => update((state) => stepTab(state, step)),
        selectPosition: (position: number) => update((state) => tabAt(state, position))
    }
}
