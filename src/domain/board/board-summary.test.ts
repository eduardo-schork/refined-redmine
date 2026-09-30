import { describe, expect, it } from 'vitest'
import type { Issue } from '../redmine/entities'
import { summarizeBoard } from './board-summary'

const NOW = new Date('2026-09-29T12:00:00')
const OPTIONS = { staleDays: 5, now: NOW }
const NEW = { id: 1, name: 'Nova', is_closed: false }
const DOING = { id: 2, name: 'Em andamento', is_closed: false }
const DONE = { id: 5, name: 'Finalizada', is_closed: true }
const ANA = { id: 7, name: 'Ana' }

const issue = (id: number, patch: Partial<Issue> = {}): Issue => ({
    id,
    project: { id: 1, name: 'Store' },
    tracker: { id: 1, name: 'Bug' },
    status: NEW,
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'Bia' },
    subject: `Issue ${id}`,
    done_ratio: 0,
    created_on: '2026-09-20T10:00:00Z',
    updated_on: '2026-09-29T10:00:00Z',
    ...patch
})

describe('summarizeBoard', () => {
    const issues = [
        issue(1, { assigned_to: ANA, status: DOING, estimated_hours: 4, priority: { id: 4, name: 'Urgente' } }),
        issue(2, { assigned_to: ANA, status: DONE, estimated_hours: 2 }),
        issue(3, { due_date: '2026-09-01', tracker: { id: 2, name: 'Feature' } }),
        issue(4, { assigned_to: ANA, status: NEW })
    ]
    const summary = summarizeBoard(issues, [DOING.id, NEW.id, DONE.id], OPTIONS)

    it('counts totals and signals', () => {
        expect(summary).toMatchObject({
            total: 4,
            open: 3,
            closed: 1,
            closedPercent: 25,
            overdue: 1,
            highPriority: 1,
            unassigned: 1,
            estimatedHours: 6
        })
    })

    it('orders statuses like the board columns', () => {
        expect(summary.byStatus.map((slice) => [slice.name, slice.count, slice.tone])).toEqual([
            ['Em andamento', 1, 'progress'],
            ['Nova', 2, 'new'],
            ['Finalizada', 1, 'done']
        ])
    })

    it('summarizes each person, unassigned last', () => {
        expect(summary.byAssignee.map((person) => [person.name, person.open, person.closed])).toEqual([
            ['Ana', 2, 1],
            [undefined, 1, 0]
        ])
        expect(summary.byAssignee[0].estimatedHours).toBe(6)
    })

    it('orders priorities from the most urgent', () => {
        expect(summary.byPriority.map((slice) => slice.name)).toEqual(['Urgente', 'Normal'])
    })
})
