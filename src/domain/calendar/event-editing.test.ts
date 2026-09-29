import { describe, expect, it } from 'vitest'
import { parseLocal } from '../shared/date'
import type { CalendarChange, CalendarEvent } from './calendar-event'
import { atOccurrence, planDelete, planSave } from './event-editing'
import { expand } from './recurrence'

let idCounter = 0
const context = { newId: () => `new${++idCounter}`, nowIso: '2026-09-28T12:00:00.000Z' }
const series: CalendarEvent = {
    id: 'S',
    title: 'Daily',
    color: 'peacock',
    allDay: false,
    start: '2026-09-28T09:00',
    end: '2026-09-28T09:15',
    recurrence: { freq: 'daily', interval: 1 },
    reminders: [5],
    createdAt: '',
    updatedAt: ''
}

/** Applies the change and lists the week as "day@time" (* = new event). */
function week(change: CalendarChange, original = series): string[] {
    const removedIds = change.remove ?? []
    const upserted = change.upsert ?? []
    const keptOriginal = [original].filter((event) => !removedIds.includes(event.id))
    const updatedOriginal = keptOriginal.map(
        (event) => upserted.find((candidate) => candidate.id === event.id) ?? event
    )
    const newEvents = upserted.filter((event) => event.id !== original.id)
    const events = updatedOriginal.concat(newEvents)
    return expand(events, parseLocal('2026-09-28'), parseLocal('2026-10-04')).map((occurrence) => {
        const day = occurrence.key.slice(8)
        const time = occurrence.start.toTimeString().slice(0, 5)
        const newMarker = occurrence.event.id === original.id ? '' : '*'
        return `${day}@${time}${newMarker}`
    })
}

const occurrenceOn30th = (event = series) => expand([event], parseLocal('2026-09-30'), parseLocal('2026-10-01'))[0]
const movedTo10am = { ...atOccurrence(series, occurrenceOn30th()), start: '2026-09-30T10:00', end: '2026-09-30T10:30' }

describe('planSave', () => {
    it('this: exception + standalone event', () => {
        expect(week(planSave(series, movedTo10am, '2026-09-30', 'this', context))).toEqual([
            '28@09:00',
            '29@09:00',
            '30@10:00*',
            '01@09:00',
            '02@09:00',
            '03@09:00'
        ])
    })
    it('this and following: splits the series', () => {
        expect(week(planSave(series, movedTo10am, '2026-09-30', 'following', context))).toEqual([
            '28@09:00',
            '29@09:00',
            '30@10:00*',
            '01@10:00*',
            '02@10:00*',
            '03@10:00*'
        ])
    })
    it('all: changes the whole series', () => {
        expect(week(planSave(series, movedTo10am, '2026-09-30', 'all', context))).toEqual([
            '28@10:00',
            '29@10:00',
            '30@10:00',
            '01@10:00',
            '02@10:00',
            '03@10:00'
        ])
    })
    it('all: moving the date shifts the series', () => {
        const moved = { ...movedTo10am, start: '2026-10-01T09:00', end: '2026-10-01T09:15' }
        expect(week(planSave(series, moved, '2026-09-30', 'all', context))).toEqual([
            '29@09:00',
            '30@09:00',
            '01@09:00',
            '02@09:00',
            '03@09:00'
        ])
    })
    it('a series with a count is split without losing occurrences', () => {
        const counted = { ...series, recurrence: { freq: 'daily' as const, interval: 1, count: 5 } }
        const draft = {
            ...atOccurrence(counted, occurrenceOn30th(counted)),
            start: '2026-09-30T11:00',
            end: '2026-09-30T11:15'
        }
        const change = planSave(counted, draft, '2026-09-30', 'following', context)
        expect(change.upsert?.map((event) => event.recurrence?.count)).toEqual([2, 3])
    })
})

describe('planDelete', () => {
    it('this', () =>
        expect(week(planDelete(series, '2026-09-30', 'this', context.nowIso))).toEqual([
            '28@09:00',
            '29@09:00',
            '01@09:00',
            '02@09:00',
            '03@09:00'
        ]))
    it('this and following', () =>
        expect(week(planDelete(series, '2026-09-30', 'following', context.nowIso))).toEqual(['28@09:00', '29@09:00']))
    it('all', () => expect(planDelete(series, '2026-09-30', 'all', context.nowIso)).toEqual({ remove: ['S'] }))
})
