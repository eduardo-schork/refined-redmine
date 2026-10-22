import { describe, expect, it } from 'vitest'
import type { TimeEntry } from './time-entry'
import { daysOf, focusedEntries, groupEntries, periodRange, teamSheet, assertValidTeam } from './team'

const ana = { id: 1, name: 'Ana' }
const bia = { id: 2, name: 'Bia' }
const caio = { id: 3, name: 'Caio' }

function entry(user: typeof ana, day: string, hours: number, issueId: number, activity = 'Desenvolvimento') {
    return { user, spent_on: day, hours, issue: { id: issueId }, activity: { id: 9, name: activity } } as TimeEntry
}

const entries = [
    entry(ana, '2026-10-19', 6, 1201),
    entry(ana, '2026-10-20', 2, 1202, 'Reunião'),
    entry(bia, '2026-10-20', 4, 1201),
    entry({ id: 99, name: 'Fora do time' }, '2026-10-20', 8, 1201),
    entry(bia, '2026-10-25', 1, 1201)
]

describe('periodRange', () => {
    const thursday = new Date(2026, 9, 22)
    it('weeks start on Monday; this week and this month stop today', () => {
        expect(periodRange('thisWeek', thursday)).toEqual({ from: '2026-10-19', to: '2026-10-22' })
        expect(periodRange('lastWeek', thursday)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
        expect(periodRange('thisMonth', thursday)).toEqual({ from: '2026-10-01', to: '2026-10-22' })
        expect(daysOf('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    })
})

describe('teamSheet', () => {
    const sheet = teamSheet(entries, [ana, bia, caio], daysOf('2026-10-19', '2026-10-22'))
    it('counts only members and days of the period', () => {
        expect(sheet.rows.map((row) => [row.member.name, row.total])).toEqual([
            ['Ana', 8],
            ['Bia', 4],
            ['Caio', 0]
        ])
        expect(sheet.dayTotals['2026-10-20']).toBe(6)
        expect(sheet.total).toBe(12)
        expect([sheet.entryCount, sheet.contributors]).toEqual([3, 2])
    })
    it('averages over every member, and over weekdays', () => {
        expect(sheet.perPerson).toBe(4)
        expect(sheet.perPersonPerWorkday).toBe(1)
    })
})

describe('groupEntries and focus', () => {
    it('groups by issue or activity, most hours first', () => {
        const byIssue = groupEntries(entries.slice(0, 3), 'issue')
        expect(byIssue.map((group) => [group.issueId, group.hours])).toEqual([
            [1201, 10],
            [1202, 2]
        ])
        expect(groupEntries(entries.slice(0, 3), 'activity').map((group) => group.activity)).toEqual([
            'Desenvolvimento',
            'Reunião'
        ])
    })
    it('narrows to a person, a day or both', () => {
        expect(focusedEntries(entries, { memberId: 1, day: '2026-10-20' })).toHaveLength(1)
        expect(focusedEntries(entries, { day: '2026-10-20' })).toHaveLength(3)
    })
    it('a team needs a name and members', () => {
        expect(() => assertValidTeam({ id: 't', name: ' ', members: [ana] })).toThrow('team.nameRequired')
        expect(() => assertValidTeam({ id: 't', name: 'Dev', members: [] })).toThrow('team.noMembers')
    })
})
