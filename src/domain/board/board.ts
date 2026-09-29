import type { SprintAutoPick } from '../sprint/sprint'

export type BoardSource =
    | { type: 'mine' }
    | { type: 'project'; projectId: number; includeSubprojects: boolean }
    | { type: 'query'; queryId: number; projectId?: number }
    // Address of any Redmine issue list (saved query or ad-hoc filters).
    | { type: 'filter'; url: string }
    // Fixed sprint (versionId) or automatic: follows the sprint of the chosen phase.
    | { type: 'sprint'; versionId?: number; auto?: SprintAutoPick; onlyMine?: boolean }

export interface BoardColumn {
    id: string
    name: string
    statusIds: number[]
}

/** A kanban board: local configuration, does not exist in Redmine. */
export interface Board {
    id: string
    name: string
    source: BoardSource
    columns: BoardColumn[]
    swimlanes: 'none' | 'assignee'
}

export const MAX_BOARD_ISSUES = 500
