import { describe, expect, it } from 'vitest'
import type { Issue } from '../redmine/entities'
import { DEFAULT_ISSUE_STYLE } from '../redmine/issue-style'
import { isPendingWork, remainingHours } from './remaining-work'

const status = (id: number, name: string, closed = false) => ({ id, name, is_closed: closed })

const issue = (patch: Partial<Issue>): Issue => ({
    id: 1,
    project: { id: 1, name: 'Store' },
    tracker: { id: 1, name: 'Dev' },
    status: status(1, 'Nova'),
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'Bia' },
    subject: 'Issue',
    done_ratio: 0,
    estimated_hours: 10,
    created_on: '2026-09-20T10:00:00Z',
    updated_on: '2026-09-29T10:00:00Z',
    ...patch
})

describe('remaining work', () => {
    it('counts new, in progress, paused and awaiting approval; not testing, resolved or closed', () => {
        const pending = ['Nova', 'Em andamento', 'Em pausa', 'Em aprovação']
        const past = ['Em teste', 'Resolvida']
        expect(pending.map((name) => isPendingWork(issue({ status: status(2, name) })))).toEqual([
            true,
            true,
            true,
            true
        ])
        expect(past.map((name) => isPendingWork(issue({ status: status(2, name) })))).toEqual([false, false])
        expect(isPendingWork(issue({ status: status(5, 'Finalizada', true) }))).toBe(false)
    })

    it('takes off the share already done', () => {
        expect(remainingHours(issue({ done_ratio: 40 }))).toBe(6)
        expect(remainingHours(issue({ estimated_hours: null }))).toBe(0)
        expect(remainingHours(issue({ status: status(3, 'Em teste'), done_ratio: 0 }))).toBe(0)
    })

    it('follows the family the user chose for a status', () => {
        const rules = { ...DEFAULT_ISSUE_STYLE, statusTones: { 3: 'progress' as const } }
        expect(remainingHours(issue({ status: status(3, 'Em teste') }), rules)).toBe(10)
    })
})
