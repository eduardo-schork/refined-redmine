import { describe, expect, it } from 'vitest'
import type { Issue } from '../redmine/entities'
import { groupIssues, nextSort, sortIssues } from './issue-list'

const statuses = [
    { id: 1, name: 'Nova', is_closed: false },
    { id: 2, name: 'Em andamento', is_closed: false },
    { id: 5, name: 'Finalizada', is_closed: true }
]

const issue = (id: number, patch: Partial<Issue> = {}): Issue => ({
    id,
    project: { id: 10, name: 'Loja' },
    tracker: { id: 1, name: 'Desenvolvimento' },
    status: statuses[0],
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'Ana' },
    subject: `Tarefa ${id}`,
    done_ratio: 0,
    created_on: '',
    updated_on: '2026-09-30T10:00:00Z',
    ...patch
})

const context = { statusOrder: statuses.map((status) => status.id) }

describe('sortIssues', () => {
    const issues = [
        issue(1, { priority: { id: 2, name: 'Normal' }, fixed_version: { id: 310, name: '3.10' } }),
        issue(2, { priority: { id: 4, name: 'Urgente' }, fixed_version: { id: 39, name: '3.9' } }),
        issue(3, { priority: { id: 3, name: 'Alta' }, status: statuses[1] })
    ]

    it('sorts by priority level, the most urgent first by default', () => {
        const sorted = sortIssues(issues, { column: 'priority', direction: 'desc' }, context)
        expect(sorted.map((item) => item.id)).toEqual([2, 3, 1])
    })

    it('sorts versions numerically and puts missing values last', () => {
        const sorted = sortIssues(issues, { column: 'version', direction: 'asc' }, context)
        expect(sorted.map((item) => item.fixed_version?.name)).toEqual(['3.9', '3.10', undefined])
    })

    it('sorts by estimated hours either way, issues without an estimate (or zero) last', () => {
        const estimated = [
            issue(1, { estimated_hours: 8 }),
            issue(2, { estimated_hours: null }),
            issue(3, { estimated_hours: 2.5 }),
            issue(4, { estimated_hours: 0 })
        ]
        const ascending = sortIssues(estimated, { column: 'estimate', direction: 'asc' }, context)
        const descending = sortIssues(estimated, { column: 'estimate', direction: 'desc' }, context)
        expect(ascending.map((item) => item.id).slice(0, 2)).toEqual([3, 1])
        expect(descending.map((item) => item.id).slice(0, 2)).toEqual([1, 3])
        expect(ascending.slice(2).map((item) => item.id)).toEqual(expect.arrayContaining([2, 4]))
        expect(descending.slice(2).map((item) => item.id)).toEqual(expect.arrayContaining([2, 4]))
    })

    it('flips the direction on the same column and starts a new one ascending (priority descending)', () => {
        expect(nextSort({ column: 'id', direction: 'asc' }, 'id')).toEqual({ column: 'id', direction: 'desc' })
        expect(nextSort({ column: 'id', direction: 'asc' }, 'subject')).toEqual({ column: 'subject', direction: 'asc' })
        expect(nextSort({ column: 'id', direction: 'asc' }, 'priority')).toEqual({
            column: 'priority',
            direction: 'desc'
        })
    })
})

describe('groupIssues', () => {
    const issues = [
        issue(1, { fixed_version: { id: 310, name: '3.10' } }),
        issue(2),
        issue(3, { fixed_version: { id: 39, name: '3.9' }, status: statuses[2] }),
        issue(4, { fixed_version: { id: 310, name: '3.10' }, status: statuses[1] })
    ]

    it('groups by version in version order, without version last, keeping the order inside', () => {
        const groups = groupIssues(issues, 'version', statuses)
        expect(groups.map((group) => [group.label, group.issues.map((item) => item.id)])).toEqual([
            ['3.9', [3]],
            ['3.10', [1, 4]],
            [undefined, [2]]
        ])
    })

    it('groups by status in Redmine order, or not at all', () => {
        expect(groupIssues(issues, 'status', statuses).map((group) => group.label)).toEqual([
            'Nova',
            'Em andamento',
            'Finalizada'
        ])
        expect(groupIssues(issues, 'none', statuses)).toHaveLength(1)
    })
})
