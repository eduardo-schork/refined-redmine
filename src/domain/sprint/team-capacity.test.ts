import { describe, expect, it } from 'vitest'
import type { Issue } from '../redmine/entities'
import { DEFAULT_WORK_SCHEDULE } from '../time/business-hours'
import { teamCapacity } from './team-capacity'

const DOING = { id: 2, name: 'Em andamento', is_closed: false }
const TESTING = { id: 110, name: 'Em teste', is_closed: false }
const ana = { id: 1, name: 'Ana' }
const bia = { id: 2, name: 'Bia', hoursPerDay: 4 }
const caio = { id: 3, name: 'Caio' }

const issue = (id: number, patch: Partial<Issue>): Issue => ({
    id,
    project: { id: 1, name: 'Store' },
    tracker: { id: 1, name: 'Dev' },
    status: DOING,
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'Bia' },
    subject: `Issue ${id}`,
    done_ratio: 0,
    created_on: '2026-10-20T10:00:00Z',
    updated_on: '2026-10-26T10:00:00Z',
    ...patch
})

const issues = [
    issue(1, { assigned_to: ana, estimated_hours: 10, done_ratio: 40 }),
    issue(2, { assigned_to: ana, estimated_hours: 4, status: TESTING }),
    issue(3, { assigned_to: caio, estimated_hours: 8 })
]

// Tuesday 27/10 at 10:00, deadline Thursday 29/10: 7 h left today (10–12, 13–18) + 9 + 9.
const NOW = new Date(2026, 9, 27, 10, 0)

describe('teamCapacity', () => {
    const capacity = teamCapacity({
        issues,
        members: [ana, bia],
        devDeadline: '2026-10-29',
        now: NOW,
        schedule: DEFAULT_WORK_SCHEDULE
    })

    it('compares the working hours left with what each member still has to do', () => {
        const [anaRow] = capacity.rows
        expect(anaRow).toMatchObject({ pendingIssues: 1, remainingHours: 6, availableHours: 25, balance: 19 })
    })

    it('lists members without issues, scaled to their own hours per day, and leaves out people outside the team', () => {
        const biaRow = capacity.rows[1]
        expect(biaRow).toMatchObject({ pendingIssues: 0, remainingHours: 0, availableHours: 11.11, balance: 11.11 })
        expect(capacity.rows.map((row) => row.member.id)).toEqual([1, 2])
        expect(capacity.total).toEqual({ pendingIssues: 1, remainingHours: 6, availableHours: 36.11, balance: 30.11 })
    })

    it('counts an upcoming sprint only from its start; a started one from now', () => {
        const window = (devStart: string, devDeadline: string) =>
            teamCapacity({
                issues: [],
                members: [ana],
                devStart,
                devDeadline,
                now: NOW,
                schedule: DEFAULT_WORK_SCHEDULE
            }).rows[0].availableHours
        // Next sprint: Thursday 29/10 to Monday 02/11 = 3 work days, nothing of the current one.
        expect(window('2026-10-29', '2026-11-02')).toBe(27)
        // Started on 20/10: from now, as without a start.
        expect(window('2026-10-20', '2026-10-29')).toBe(25)
    })

    it('has no working hours after the dev deadline, so everything left is missing', () => {
        const late = teamCapacity({
            issues,
            members: [ana],
            devDeadline: '2026-10-26',
            now: NOW,
            schedule: DEFAULT_WORK_SCHEDULE
        })
        expect(late.rows[0]).toMatchObject({ availableHours: 0, balance: -6 })
    })
})
