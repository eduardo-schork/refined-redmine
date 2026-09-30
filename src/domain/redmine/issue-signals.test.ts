import { describe, expect, it } from 'vitest'
import type { Issue } from './entities'
import { countSignals, dueState, priorityLevel } from './issue-signals'
import { DEFAULT_ISSUE_STYLE } from './issue-style'

const NOW = new Date('2026-09-29T12:00:00')

const issue = (patch: Partial<Issue> = {}): Issue => ({
    id: 1,
    project: { id: 1, name: 'Store' },
    tracker: { id: 1, name: 'Bug' },
    status: { id: 1, name: 'Nova', is_closed: false },
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'Ana' },
    assigned_to: { id: 2, name: 'Bruno' },
    subject: 'Title',
    done_ratio: 0,
    created_on: '2026-09-20T10:00:00Z',
    updated_on: '2026-09-29T10:00:00Z',
    ...patch
})

describe('priorityLevel', () => {
    it('recognizes Portuguese and English names', () => {
        expect(priorityLevel({ id: 1, name: 'Imediata' })).toBe('urgent')
        expect(priorityLevel({ id: 1, name: 'Urgent' })).toBe('urgent')
        expect(priorityLevel({ id: 1, name: 'Alta' })).toBe('high')
        expect(priorityLevel({ id: 1, name: 'Low' })).toBe('low')
        expect(priorityLevel({ id: 1, name: 'Normal' })).toBe('normal')
    })
})

describe('user choices', () => {
    const rules = { ...DEFAULT_ISSUE_STYLE, priorityLevels: { 9: 'urgent' as const }, dueSoonDays: 10 }

    it('wins over the name', () => {
        expect(priorityLevel({ id: 9, name: 'P1' }, rules)).toBe('urgent')
        expect(priorityLevel({ id: 8, name: 'P1' }, rules)).toBe('normal')
    })

    it('widens the due soon window', () => {
        expect(dueState(issue({ due_date: '2026-10-08' }), NOW, rules.dueSoonDays)).toBe('soon')
    })
})

describe('dueState', () => {
    it('grades the due date', () => {
        expect(dueState(issue({ due_date: '2026-09-28' }), NOW)).toBe('overdue')
        expect(dueState(issue({ due_date: '2026-09-29' }), NOW)).toBe('today')
        expect(dueState(issue({ due_date: '2026-10-02' }), NOW)).toBe('soon')
        expect(dueState(issue({ due_date: '2026-10-10' }), NOW)).toBe('later')
        expect(dueState(issue(), NOW)).toBe('none')
    })

    it('ignores closed issues', () => {
        const closed = issue({ due_date: '2026-09-01', status: { id: 5, name: 'Fechada', is_closed: true } })
        expect(dueState(closed, NOW)).toBe('none')
    })
})

describe('countSignals', () => {
    it('counts each signal once per issue', () => {
        const issues = [
            issue({ due_date: '2026-09-01', priority: { id: 4, name: 'Urgente' } }),
            issue({ assigned_to: undefined, updated_on: '2026-09-01T10:00:00Z' }),
            issue({ status: { id: 9, name: 'Em pausa', is_closed: false } })
        ]
        expect(countSignals(issues, { staleDays: 5, now: NOW })).toEqual({
            overdue: 1,
            highPriority: 1,
            stale: 2,
            unassigned: 1
        })
    })
})
