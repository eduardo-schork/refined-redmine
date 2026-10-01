import { DEFAULT_LIST_SORT, type ListGroupBy, type ListSort } from '@domain/board/issue-list'
import { EMPTY_QUICK_FILTER, withQuickFilterDefaults, type QuickFilter } from '@domain/board/quick-filter'

/** How a board was last looked at on this computer: view, quick filters, list grouping and sort. */
export interface BoardViewPrefs {
    mode: 'board' | 'summary' | 'list'
    filter: QuickFilter
    groupBy: ListGroupBy
    sort: ListSort
}

const MODES = ['board', 'summary', 'list'] as const
const GROUPS: ListGroupBy[] = ['version', 'status', 'assignee', 'tracker', 'none']
const COLUMNS = ['id', 'tracker', 'status', 'priority', 'subject', 'assignee', 'version', 'due'] as const

export const DEFAULT_VIEW_PREFS: BoardViewPrefs = {
    mode: 'board',
    filter: EMPTY_QUICK_FILTER,
    groupBy: 'version',
    sort: DEFAULT_LIST_SORT
}

const keyOf = (boardId: string) => `refined-redmine.board-view.${boardId}`

function validSort(value: unknown): ListSort {
    const sort = value as Partial<ListSort> | undefined
    const column = COLUMNS.find((candidate) => candidate === sort?.column)
    const direction = sort?.direction === 'asc' || sort?.direction === 'desc' ? sort.direction : undefined
    return column && direction ? { column, direction } : DEFAULT_LIST_SORT
}

/** A per-computer convenience: anything missing or unexpected falls back to the defaults. */
export function loadViewPrefs(boardId: string): BoardViewPrefs {
    try {
        const stored = JSON.parse(localStorage.getItem(keyOf(boardId)) ?? '{}')
        return {
            mode: MODES.find((mode) => mode === stored.mode) ?? DEFAULT_VIEW_PREFS.mode,
            filter: withQuickFilterDefaults(stored.filter),
            groupBy: GROUPS.find((groupBy) => groupBy === stored.groupBy) ?? DEFAULT_VIEW_PREFS.groupBy,
            sort: validSort(stored.sort)
        }
    } catch {
        return DEFAULT_VIEW_PREFS
    }
}

export function saveViewPrefs(boardId: string, prefs: BoardViewPrefs): void {
    try {
        localStorage.setItem(keyOf(boardId), JSON.stringify(prefs))
    } catch {
        // Storage unavailable: the board opens with the defaults next time.
    }
}
