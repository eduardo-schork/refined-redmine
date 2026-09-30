import { describe, expect, it } from 'vitest'
import type { Issue, Version } from '../redmine/entities'
import type { Sprint } from './sprint'
import { sprintProgress, workingDaysBetween } from './sprint-progress'

const version = { id: 378, name: '3.78', status: 'open' } as Version
const sprint: Sprint = {
    version,
    kind: 'sprint',
    phase: 'dev',
    devStart: '2026-09-24',
    devDeadline: '2026-10-07',
    release: '2026-10-16'
}

const OPEN = { id: 2, name: 'Em andamento', is_closed: false }
const CLOSED = { id: 5, name: 'Finalizada', is_closed: true }

const issue = (id: number, patch: Partial<Issue> = {}): Issue => ({
    id,
    project: { id: 1, name: 'Store' },
    tracker: { id: 1, name: 'Bug' },
    status: OPEN,
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'Bia' },
    subject: `Issue ${id}`,
    done_ratio: 0,
    created_on: '2026-09-20T10:00:00Z',
    updated_on: '2026-09-29T10:00:00Z',
    ...patch
})

describe('workingDaysBetween', () => {
    it('counts Monday to Friday, both ends included', () => {
        // Tuesday 29/09 to Wednesday 07/10: 29, 30, 1, 2, 5, 6, 7.
        expect(workingDaysBetween(new Date('2026-09-29T12:00:00'), new Date('2026-10-07T00:00:00'))).toBe(7)
    })
})

describe('sprintProgress', () => {
    const today = new Date('2026-09-30T12:00:00')

    it('compares the closed share with the time gone', () => {
        // 7 of 14 days gone (50%); 1 of 4 closed (25%) → behind by more than the tolerance.
        const issues = [issue(1, { status: CLOSED }), issue(2), issue(3), issue(4, { estimated_hours: 6 })]
        const progress = sprintProgress(sprint, issues, today)
        expect(progress).toMatchObject({
            elapsedPercent: 50,
            closedPercent: 25,
            pace: 'behind',
            open: 3,
            workingDaysLeft: 6,
            openPerWorkingDay: 0.5,
            daysToDevDeadline: 7,
            daysToRelease: 16,
            remainingEstimate: 6
        })
    })

    it('counts the issues closed in the last 7 days', () => {
        const issues = [
            issue(1, { status: CLOSED, closed_on: '2026-09-28T15:00:00Z' }),
            issue(2, { status: CLOSED, closed_on: '2026-09-10T15:00:00Z' }),
            issue(3)
        ]
        expect(sprintProgress(sprint, issues, today).closedLastWeek).toBe(1)
    })

    it('counts issues created after the start as added scope', () => {
        const issues = [issue(1), issue(2, { created_on: '2026-09-28T09:00:00Z' })]
        expect(sprintProgress(sprint, issues, today).addedAfterStart).toBe(1)
    })

    it('has no pace outside development', () => {
        const inQa: Sprint = { ...sprint, phase: 'qa' }
        const afterDeadline = new Date('2026-10-09T12:00:00')
        const progress = sprintProgress(inQa, [issue(1)], afterDeadline)
        expect(progress.pace).toBeUndefined()
        expect(progress.workingDaysLeft).toBeUndefined()
        expect(progress.elapsedPercent).toBe(100)
    })
})
