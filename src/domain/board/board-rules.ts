import { AppError } from '../shared/errors'
import type { IssueStatus, Version } from '../redmine/entities'
import type { NewIssueDefaults } from '../redmine/issue-edit'
import type { IssueFilter } from '../redmine/issue-filter'
import { parseIssuesUrl } from '../redmine/issues-url'
import type { Board, BoardColumn, BoardSource } from './board'

export function columnOf(board: Board, statusId: number): BoardColumn | undefined {
    return board.columns.find((column) => column.statusIds.includes(statusId))
}

/**
 * Can a card be dropped on this column? The current column always can; with `allowed` unknown (still loading),
 * it does not block. Otherwise, the column must have some status allowed by the Redmine workflow.
 */
export function canDropOn(column: BoardColumn, currentStatusId: number, allowed: ReadonlySet<number> | null): boolean {
    if (column.statusIds.includes(currentStatusId)) return true
    if (!allowed) return true
    return column.statusIds.some((statusId) => allowed.has(statusId))
}

/** Target status when dropping on the column: the first one in the column that the workflow allows. */
export function targetStatus(column: BoardColumn, allowed: ReadonlySet<number>): number {
    const target = column.statusIds.find((statusId) => allowed.has(statusId))
    if (target === undefined) throw new AppError('workflow.transitionNotAllowed', { column: column.name })
    return target
}

/** One column per open status + one column with all the closed ones. */
export function columnsFromStatuses(statuses: IssueStatus[], newId: () => string, closedLabel: string): BoardColumn[] {
    const openStatuses = statuses.filter((status) => !status.is_closed)
    const openColumns = openStatuses.map((status) => ({ id: newId(), name: status.name, statusIds: [status.id] }))

    const closedStatusIds = statuses.filter((status) => status.is_closed).map((status) => status.id)
    if (closedStatusIds.length === 0) return openColumns

    const closedColumn = { id: newId(), name: closedLabel, statusIds: closedStatusIds }
    return [...openColumns, closedColumn]
}

/**
 * "Ágil": every open issue assigned to me, one column per open status. Created once for each user; after that it is
 * an ordinary board (renamed, changed or deleted at will).
 */
export function createAgileBoard(statuses: IssueStatus[], id: string, name: string): Board {
    const openStatuses = statuses.filter((status) => !status.is_closed)
    const columns = openStatuses.map((status) => ({
        id: `${id}-${status.id}`,
        name: status.name,
        statusIds: [status.id]
    }))
    return { id, name, source: { type: 'mine' }, columns, swimlanes: 'none' }
}

/**
 * Issues that suggest the columns of a new board: "mine" and project boards look at the open issues, a sprint at all
 * of them (closed ones too), saved queries and copied filters at what Redmine returns for them.
 */
export function columnSuggestionFilter(source: BoardSource, filter: IssueFilter): IssueFilter {
    if (source.type === 'mine' || source.type === 'project') return { ...filter, status: 'open' }
    if (source.type === 'sprint') return { ...filter, status: '*' }
    return filter
}

/** Statuses the issues are in, in Redmine's order (the columns of `columnsFromStatuses` follow them). */
export function suggestedStatuses(statuses: IssueStatus[], presentStatusIds: number[]): IssueStatus[] {
    const present = new Set(presentStatusIds)
    return statuses.filter((status) => present.has(status.id))
}

function assertValidSource(source: BoardSource): void {
    if (source.type === 'project' && !source.projectId) throw new AppError('board.projectRequired')
    if (source.type === 'query' && !source.queryId) throw new AppError('board.queryRequired')
    if (source.type === 'filter' && !source.url.trim()) throw new AppError('board.filterRequired')
    if (source.type === 'filter') parseIssuesUrl(source.url)
    if (source.type === 'sprint' && !source.versionId && !source.auto) throw new AppError('board.sprintRequired')
}

/** The source has everything it needs (project, query, address or sprint chosen). */
export function isCompleteSource(source: BoardSource): boolean {
    try {
        assertValidSource(source)
        return true
    } catch {
        return false
    }
}

/** Throws the first error found. */
export function assertValidBoard(board: Board): void {
    if (!board.name.trim()) throw new AppError('board.nameRequired')
    assertValidSource(board.source)
    const hasAnyStatus = board.columns.some((column) => column.statusIds.length > 0)
    if (!hasAnyStatus) throw new AppError('board.columnsRequired')
}

/**
 * Issue filter for the board. `versionId` is the already resolved sprint (fixed or automatic).
 * With a saved query or a copied filter, Redmine applies those filters (the columns' statuses are not added).
 */
export function boardIssueFilter(board: Board, versionId?: number): IssueFilter {
    const status = board.columns.flatMap((column) => column.statusIds)
    const source = board.source
    switch (source.type) {
        case 'mine':
            return { assignedTo: 'me', status, sort: 'priority' }
        case 'project': {
            const project = { id: source.projectId, includeSubprojects: source.includeSubprojects }
            return { project, status, sort: 'priority' }
        }
        case 'query':
            return { queryId: source.queryId, queryProjectId: source.projectId }
        case 'filter':
            return { rawQuery: parseIssuesUrl(source.url).query }
        case 'sprint': {
            const assignedTo = source.onlyMine ? 'me' : undefined
            return { versionId, assignedTo, status, sort: 'priority' }
        }
    }
}

/** Column names when a status change moves the card to another column; null when it stays in the same one. */
export function columnChange(
    board: Board,
    fromStatusId: number,
    toStatusId: number
): { from: string; to: string } | null {
    const fromColumn = columnOf(board, fromStatusId)
    const toColumn = columnOf(board, toStatusId)
    if (!fromColumn || !toColumn) return null
    if (fromColumn.id === toColumn.id) return null
    return { from: fromColumn.name, to: toColumn.name }
}

/**
 * A new issue created from a board starts in the board's project, and in its sprint when the board follows one.
 * `sprintVersion` is the already resolved sprint (fixed or automatic).
 */
export function newIssueDefaults(board: Board, sprintVersion?: Pick<Version, 'id' | 'project'>): NewIssueDefaults {
    const source = board.source
    switch (source.type) {
        case 'project':
        case 'query':
            return { projectId: source.projectId }
        case 'sprint':
            if (!sprintVersion) return {}
            return { projectId: sprintVersion.project.id, fixedVersionId: sprintVersion.id }
        case 'mine':
        case 'filter':
            return {}
    }
}
