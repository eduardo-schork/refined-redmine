import { describe, expect, it } from 'vitest'
import { AppError } from '../shared/errors'
import type { Board } from './board'
import {
    assertValidBoard,
    columnChange,
    boardIssueFilter,
    canDropOn,
    columnOf,
    columnsFromStatuses,
    newIssueDefaults,
    targetStatus
} from './board-rules'

const board: Board = {
    id: 'b',
    name: 'Sprint',
    source: { type: 'sprint', auto: 'dev' },
    swimlanes: 'none',
    columns: [
        { id: 'todo', name: 'To do', statusIds: [1] },
        { id: 'doing', name: 'Doing', statusIds: [2, 8] },
        { id: 'done', name: 'Done', statusIds: [5] }
    ]
}

describe('board rules', () => {
    it('finds the column by status', () => {
        expect(columnOf(board, 8)?.id).toBe('doing')
    })

    it('respects the Redmine workflow on drop', () => {
        const allowed = new Set([1, 2])
        expect(canDropOn(board.columns[1], 1, allowed)).toBe(true)
        expect(canDropOn(board.columns[2], 1, allowed)).toBe(false)
        expect(canDropOn(board.columns[2], 1, null)).toBe(true) // still loading
        expect(targetStatus(board.columns[1], new Set([8]))).toBe(8)
        expect(() => targetStatus(board.columns[2], allowed)).toThrow(AppError)
    })

    it('builds columns from statuses', () => {
        let counter = 0
        const columns = columnsFromStatuses(
            [
                { id: 1, name: 'Nova', is_closed: false },
                { id: 5, name: 'Finalizada', is_closed: true },
                { id: 6, name: 'Rejeitada', is_closed: true }
            ],
            () => `c${counter++}`,
            'Closed'
        )
        expect(columns.map((column) => [column.name, column.statusIds])).toEqual([
            ['Nova', [1]],
            ['Closed', [5, 6]]
        ])
    })

    it('validates invariants', () => {
        expect(() => assertValidBoard({ ...board, name: ' ' })).toThrow('board.nameRequired')
        expect(() => assertValidBoard({ ...board, source: { type: 'sprint' } })).toThrow('board.sprintRequired')
        expect(() => assertValidBoard({ ...board, columns: [] })).toThrow('board.columnsRequired')
        expect(() => assertValidBoard(board)).not.toThrow()
    })

    it('builds the search specification', () => {
        expect(boardIssueFilter(board, 2670)).toEqual({
            versionId: 2670,
            assignedTo: undefined,
            status: [1, 2, 8, 5],
            sort: 'priority'
        })
        expect(boardIssueFilter({ ...board, source: { type: 'query', queryId: 9 } })).toEqual({
            queryId: 9,
            queryProjectId: undefined
        })
    })
})

describe('columnChange', () => {
    const board = {
        id: 'b',
        name: 'B',
        source: { type: 'mine' as const },
        swimlanes: 'none' as const,
        columns: [
            { id: 'todo', name: 'To do', statusIds: [1] },
            { id: 'doing', name: 'Doing', statusIds: [2, 8] }
        ]
    }
    it('names both columns when the card moves', () =>
        expect(columnChange(board, 1, 2)).toEqual({ from: 'To do', to: 'Doing' }))
    it('same column: no column change', () => expect(columnChange(board, 2, 8)).toBeNull())
    it('filter source uses the copied parameters', () =>
        expect(boardIssueFilter({ ...board, source: { type: 'filter', url: '/issues?status_id=o' } })).toEqual({
            rawQuery: 'status_id=o'
        }))
})

describe('newIssueDefaults', () => {
    it("starts in the board's project, and in its sprint when the board follows one", () => {
        const sprintVersion = { id: 378, project: { id: 10, name: 'Loja Virtual' } }
        expect(newIssueDefaults(board, sprintVersion)).toEqual({ projectId: 10, fixedVersionId: 378 })
        expect(newIssueDefaults(board)).toEqual({})
        const projectBoard: Board = { ...board, source: { type: 'project', projectId: 7, includeSubprojects: true } }
        expect(newIssueDefaults(projectBoard)).toEqual({ projectId: 7 })
        expect(newIssueDefaults({ ...board, source: { type: 'mine' } })).toEqual({})
    })
})
