import { describe, expect, it } from 'vitest'
import type { TimeEntry } from './time-entry'
import { buildTimesheet, shiftedEntries, weekDays } from './timesheet'

const entry = (id: number, issueId: number | undefined, spentOn: string, hours: number): TimeEntry => ({
    id,
    project: { id: 10, name: 'Loja' },
    issue: issueId ? { id: issueId } : undefined,
    user: { id: 1, name: 'Marina' },
    activity: { id: 9, name: 'Desenvolvimento' },
    hours,
    comments: 'x',
    spent_on: spentOn,
    created_on: '',
    updated_on: ''
})

describe('weekDays', () => {
    it('starts on Sunday or Monday as configured', () => {
        const wednesday = new Date('2026-09-30T12:00:00')
        expect(weekDays(wednesday, 0)[0]).toBe('2026-09-27')
        expect(weekDays(wednesday, 1)).toEqual([
            '2026-09-28',
            '2026-09-29',
            '2026-09-30',
            '2026-10-01',
            '2026-10-02',
            '2026-10-03',
            '2026-10-04'
        ])
    })
})

describe('buildTimesheet', () => {
    const days = weekDays(new Date('2026-09-30T12:00:00'), 1)
    const entries = [
        entry(1, 1201, '2026-09-28', 2),
        entry(2, 1201, '2026-09-28', 0.5),
        entry(3, 1202, '2026-09-29', 4),
        entry(4, undefined, '2026-09-30', 1),
        entry(5, 1201, '2026-09-20', 8)
    ]
    const sheet = buildTimesheet(entries, days)

    it('sums by issue and day, ignoring other weeks', () => {
        expect(sheet.total).toBe(7.5)
        expect(sheet.dayTotals['2026-09-28']).toBe(2.5)
        expect(sheet.rows.map((row) => [row.issueId, row.total])).toEqual([
            [1202, 4],
            [1201, 2.5],
            [undefined, 1]
        ])
        expect(sheet.rows[1].hoursByDay['2026-09-28']).toBe(2.5)
    })
})

describe('shiftedEntries', () => {
    it('moves entries to the same weekday one week later', () => {
        const [shifted] = shiftedEntries([entry(1, 1201, '2026-09-28', 2)], 7)
        expect(shifted.spentOn).toBe('2026-10-05')
    })
})
