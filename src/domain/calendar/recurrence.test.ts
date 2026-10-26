import { describe, expect, it } from 'vitest'
import { parseLocal } from '../shared/date'
import type { CalendarEvent } from './calendar-event'
import { occurrences } from './recurrence'

const base = { id: 'x', title: 't', color: 'peacock', reminders: [], createdAt: '', updatedAt: '' } as const
const makeEvent = (overrides: Partial<CalendarEvent>): CalendarEvent =>
    ({ ...base, allDay: false, start: '', end: '', ...overrides }) as CalendarEvent
const days = (event: CalendarEvent, from: string, to: string) =>
    occurrences(event, parseLocal(from), parseLocal(to)).map((occurrence) => occurrence.key)

describe('occurrences', () => {
    it('last weekday of the month (an NFS-e reminder): weekends move back to Friday', () => {
        const event = makeEvent({
            start: '2026-10-30T09:00',
            end: '2026-10-30T09:15',
            recurrence: { freq: 'monthly', interval: 1, monthlyMode: 'lastWorkday' }
        })
        expect(days(event, '2026-10-01', '2027-03-01')).toEqual([
            '2026-10-30',
            '2026-11-30',
            '2026-12-31',
            '2027-01-29',
            '2027-02-26'
        ])
    })

    it('daily skips ahead to the requested range', () => {
        const event = makeEvent({
            start: '2026-09-28T09:00',
            end: '2026-09-28T09:15',
            recurrence: { freq: 'daily', interval: 1 }
        })
        expect(days(event, '2027-03-01', '2027-03-04')).toEqual(['2027-03-01', '2027-03-02', '2027-03-03'])
    })

    it('weekdays', () => {
        const event = makeEvent({
            start: '2026-09-25T14:00',
            end: '2026-09-25T14:15',
            recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }
        })
        expect(days(event, '2026-09-25', '2026-10-03')).toEqual([
            '2026-09-25',
            '2026-09-28',
            '2026-09-29',
            '2026-09-30',
            '2026-10-01',
            '2026-10-02'
        ])
    })

    it('every 2 weeks on Mon and Wed', () => {
        const event = makeEvent({
            start: '2026-09-28T10:00',
            end: '2026-09-28T11:00',
            recurrence: { freq: 'weekly', interval: 2, byWeekday: [1, 3] }
        })
        expect(days(event, '2026-09-28', '2026-11-01')).toEqual([
            '2026-09-28',
            '2026-09-30',
            '2026-10-12',
            '2026-10-14',
            '2026-10-26',
            '2026-10-28'
        ])
    })

    it('monthly on the 31st skips short months', () => {
        const event = makeEvent({
            start: '2026-08-31T08:00',
            end: '2026-08-31T09:00',
            recurrence: { freq: 'monthly', interval: 1, monthlyMode: 'day' }
        })
        expect(days(event, '2026-08-01', '2027-02-01')).toEqual([
            '2026-08-31',
            '2026-10-31',
            '2026-12-31',
            '2027-01-31'
        ])
    })

    it('monthly on the last Monday', () => {
        const event = makeEvent({
            start: '2026-09-28T15:00',
            end: '2026-09-28T16:00',
            recurrence: { freq: 'monthly', interval: 1, monthlyMode: 'weekday', monthlyNth: -1 }
        })
        expect(days(event, '2026-09-01', '2027-01-01')).toEqual([
            '2026-09-28',
            '2026-10-26',
            '2026-11-30',
            '2026-12-28'
        ])
    })

    it('monthly on the 2nd Tuesday, 3 times', () => {
        const event = makeEvent({
            start: '2026-10-13T09:00',
            end: '2026-10-13T10:00',
            recurrence: { freq: 'monthly', interval: 1, monthlyMode: 'weekday', monthlyNth: 2, count: 3 }
        })
        expect(days(event, '2026-10-01', '2027-06-01')).toEqual(['2026-10-13', '2026-11-10', '2026-12-08'])
    })

    it('ends on a date and respects exceptions', () => {
        const event = makeEvent({
            start: '2026-09-28T09:00',
            end: '2026-09-28T09:30',
            recurrence: { freq: 'daily', interval: 1, until: '2026-10-02' },
            exceptions: ['2026-09-30']
        })
        expect(days(event, '2026-09-01', '2026-12-01')).toEqual([
            '2026-09-28',
            '2026-09-29',
            '2026-10-01',
            '2026-10-02'
        ])
    })

    it('yearly on Feb 29 only in leap years', () => {
        const event = makeEvent({
            allDay: true,
            start: '2028-02-29',
            end: '2028-02-29',
            recurrence: { freq: 'yearly', interval: 1 }
        })
        expect(days(event, '2028-01-01', '2037-01-01')).toEqual(['2028-02-29', '2032-02-29', '2036-02-29'])
    })

    it('a multi-day event appears while it overlaps', () => {
        const event = makeEvent({ allDay: true, start: '2026-09-27', end: '2026-09-29' })
        expect(days(event, '2026-09-29', '2026-09-30')).toEqual(['2026-09-27'])
    })
})
