import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseRoute } from './router'
import {
    closeOtherTabs,
    closeTab,
    keepTabs,
    loadTabs,
    moveTab,
    openNewTab,
    openTab,
    popIssue,
    pushIssue,
    routePath,
    saveTabs,
    stepTab,
    tabAt,
    tabKey,
    type WorkspaceTabs
} from './workspace-tabs'

const start: WorkspaceTabs = { tabs: [] }
const open = (...pages: Parameters<typeof openTab>[1][]) => pages.reduce(openTab, start)
const keys = (state: WorkspaceTabs) => state.tabs.map((tab) => tab.key)

describe('openTab', () => {
    it('opens each screen once, at the end, and brings it to the front', () => {
        const state = open({ page: 'home' }, { page: 'board', boardId: 'b1' }, { page: 'time' }, { page: 'home' })
        expect(keys(state)).toEqual(['home', 'board:b1', 'time'])
        expect(state.activeKey).toBe('home')
    })
    it('each board is a tab; a calendar date or settings section stays in the same tab', () => {
        const state = open(
            { page: 'board', boardId: 'b1' },
            { page: 'board', boardId: 'b2' },
            { page: 'calendar' },
            { page: 'calendar', date: '2026-10-22' }
        )
        expect(keys(state)).toEqual(['board:b1', 'board:b2', 'calendar'])
        expect(state.tabs[2].route).toEqual({ page: 'calendar', date: '2026-10-22' })
    })
})

describe('closeTab', () => {
    const state = open({ page: 'home' }, { page: 'sprints' }, { page: 'time' })
    it('closing the tab in front shows the next one, or the previous when it was the last', () => {
        const middle = closeTab({ ...state, activeKey: 'sprints' }, 'sprints')
        expect(middle.activeKey).toBe('time')
        expect(closeTab(state, 'time').activeKey).toBe('sprints')
    })
    it('closing a tab behind keeps the one in front; closing all leaves none', () => {
        expect(closeTab(state, 'home').activeKey).toBe('time')
        const empty = [...keys(state)].reduce(closeTab, state)
        expect(empty).toEqual({ tabs: [], activeKey: undefined })
    })
})

describe('moving between tabs', () => {
    const state = open({ page: 'home' }, { page: 'sprints' }, { page: 'time' })
    it('steps around both ways and jumps by position, ⌘9 being the last', () => {
        expect(stepTab(state, 1).activeKey).toBe('home')
        expect(stepTab(state, -1).activeKey).toBe('sprints')
        expect(tabAt(state, 1).activeKey).toBe('home')
        expect(tabAt(state, 9).activeKey).toBe('time')
        expect(tabAt(state, 5)).toBe(state)
    })
})

describe('keepTabs', () => {
    it('drops the tab of a deleted board and shows the first tab when it was in front', () => {
        const state = open({ page: 'home' }, { page: 'board', boardId: 'gone' })
        const kept = keepTabs(state, (route) => route.page !== 'board' || route.boardId !== 'gone')
        expect(kept).toEqual({ tabs: [{ key: 'home', route: { page: 'home' } }], activeKey: 'home' })
    })
})

describe('routePath', () => {
    it('is read back by parseRoute, except the calendar date (reopening starts on today)', () => {
        const routes = [{ page: 'board', boardId: 'a b' }, { page: 'settings', tab: 'work' }, { page: 'log' }] as const
        for (const route of routes) expect(parseRoute(routePath(route))).toEqual(route)
        expect(parseRoute(routePath({ page: 'calendar', date: '2026-10-22' }))).toEqual({ page: 'calendar' })
        expect(tabKey({ page: 'board' })).toBe('board:')
    })
})

describe('duplicates, order and closing the others', () => {
    const state = open({ page: 'home' }, { page: 'board', boardId: 'b1' }, { page: 'time' })
    it('a new tab of an open screen gets its own key; the menu still brings the first one forward', () => {
        const duplicated = openNewTab(openNewTab(state, { page: 'board', boardId: 'b1' }), {
            page: 'board',
            boardId: 'b1'
        })
        expect(keys(duplicated)).toEqual(['home', 'board:b1', 'time', 'board:b1#2', 'board:b1#3'])
        expect(openTab(duplicated, { page: 'board', boardId: 'b1' }).activeKey).toBe('board:b1')
    })
    it('dragging a tab onto another takes its place, both ways', () => {
        expect(keys(moveTab(state, 'time', 'home'))).toEqual(['time', 'home', 'board:b1'])
        expect(keys(moveTab(state, 'home', 'time'))).toEqual(['board:b1', 'time', 'home'])
        expect(moveTab(state, 'home', 'missing')).toBe(state)
    })
    it('"close the others" keeps only that tab, in front', () => {
        expect(closeOtherTabs(state, 'board:b1')).toEqual({
            tabs: [{ key: 'board:b1', route: { page: 'board', boardId: 'b1' } }],
            activeKey: 'board:b1'
        })
    })
})

describe('issues open in a tab', () => {
    const state = open({ page: 'home' }, { page: 'board', boardId: 'b1' })
    const issuesOf = (tabs: WorkspaceTabs, key: string) => tabs.tabs.find((tab) => tab.key === key)?.issues

    it('each tab keeps its own stack; the same issue is not stacked twice in a row', () => {
        const opened = pushIssue(pushIssue(pushIssue(state, 'home', 1), 'home', 2), 'home', 2)
        const withBoardIssue = pushIssue(opened, 'board:b1', 3)
        expect(issuesOf(withBoardIssue, 'home')).toEqual([1, 2])
        expect(issuesOf(withBoardIssue, 'board:b1')).toEqual([3])
        expect(issuesOf(popIssue(withBoardIssue, 'home'), 'home')).toEqual([1])
    })
    it('survive bringing the screen to the front again and moving tabs; closing the tab drops them', () => {
        const opened = pushIssue(state, 'board:b1', 3)
        expect(issuesOf(openTab(opened, { page: 'board', boardId: 'b1' }), 'board:b1')).toEqual([3])
        expect(issuesOf(moveTab(opened, 'board:b1', 'home'), 'board:b1')).toEqual([3])
        expect(closeTab(opened, 'board:b1').tabs.flatMap((tab) => tab.issues ?? [])).toEqual([])
    })
})

describe('saveTabs and loadTabs', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('reopen the tabs with the issues that were open in each', () => {
        const stored = new Map<string, string>()
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => stored.get(key) ?? null,
            setItem: (key: string, value: string) => stored.set(key, value)
        })
        const state = pushIssue(open({ page: 'home' }, { page: 'board', boardId: 'b1' }), 'board:b1', 7)
        saveTabs(state)
        expect(loadTabs()).toEqual({
            tabs: [
                { key: 'home', route: { page: 'home' }, issues: [] },
                { key: 'board:b1', route: { page: 'board', boardId: 'b1' }, issues: [7] }
            ],
            activeKey: 'board:b1'
        })
    })
    it('tabs saved before issues were kept open come back without them', () => {
        const legacy = JSON.stringify({ paths: ['/home', '/nowhere', '/time'], activeIndex: 1 })
        vi.stubGlobal('localStorage', { getItem: () => legacy })
        expect(loadTabs()?.tabs).toEqual([
            { key: 'home', route: { page: 'home' }, issues: [] },
            { key: 'time', route: { page: 'time' }, issues: [] }
        ])
    })
})
