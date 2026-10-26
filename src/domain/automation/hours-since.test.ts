import { describe, expect, it } from 'vitest'
import type { Journal } from '../redmine/entities'
import type { TimeEntry } from '../time/time-entry'
import { defaultSince, hoursSinceOptions } from './hours-since'

const me = { id: 1, name: 'Me' }
const ana = { id: 2, name: 'Ana' }
const journal = (id: number, user: typeof me, at: string, statusChange = false): Journal => ({
    id,
    user,
    created_on: at,
    notes: statusChange ? '' : 'note',
    details: statusChange ? [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '2' }] : []
})
const issue = (journals: Journal[]) => ({
    id: 10,
    journals,
    created_on: '2026-10-20T09:00:00Z',
    author: ana
})

describe('hours since', () => {
    it('lists journals, time entries of the issue and the creation, newest first', () => {
        const entries = [
            { id: 5, issue: { id: 10 }, user: me, hours: 2, created_on: '2026-10-22T18:00:00Z' },
            { id: 6, issue: { id: 99 }, user: me, hours: 1, created_on: '2026-10-23T18:00:00Z' }
        ] as TimeEntry[]
        const options = hoursSinceOptions(issue([journal(1, ana, '2026-10-21T10:00:00Z', true)]), entries, me.id)
        expect(options.map((option) => [option.key, option.kind])).toEqual([
            ['time:5', 'timeEntry'],
            ['journal:1', 'status'],
            ['created', 'created']
        ])
    })

    it("defaults to the user's last trâmite, then the last status change, then the creation", () => {
        const withMine = hoursSinceOptions(
            issue([journal(1, me, '2026-10-21T10:00:00Z'), journal(2, ana, '2026-10-22T10:00:00Z', true)]),
            [],
            me.id
        )
        expect(defaultSince(withMine)?.key).toBe('journal:1')

        const othersOnly = hoursSinceOptions(issue([journal(2, ana, '2026-10-22T10:00:00Z', true)]), [], me.id)
        expect(defaultSince(othersOnly)?.key).toBe('journal:2')

        expect(defaultSince(hoursSinceOptions(issue([]), [], me.id))?.key).toBe('created')
    })
})
