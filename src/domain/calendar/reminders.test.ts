import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './calendar-event'
import { findDueReminders } from './reminders'

const makeEvent = (overrides: Partial<CalendarEvent>): CalendarEvent =>
    ({
        id: 'e',
        title: 'Meeting',
        color: 'peacock',
        allDay: false,
        start: '2026-09-28T12:25',
        end: '2026-09-28T12:55',
        reminders: [5],
        createdAt: '',
        updatedAt: '',
        ...overrides
    }) as CalendarEvent
const preferences = { allDayReminderHour: 9 }

describe('findDueReminders', () => {
    it('fires on time and only once', () => {
        const now = new Date(2026, 8, 28, 12, 20, 15)
        const due = findDueReminders([makeEvent({})], now, preferences, () => false)
        expect(due.map((reminder) => reminder.key)).toEqual(['e|2026-09-28|5'])
        expect(findDueReminders([makeEvent({})], now, preferences, (key) => key === 'e|2026-09-28|5')).toEqual([])
    })
    it('does not fire before the time or after the grace period', () => {
        expect(findDueReminders([makeEvent({})], new Date(2026, 8, 28, 12, 19), preferences, () => false)).toEqual([])
        expect(findDueReminders([makeEvent({})], new Date(2026, 8, 28, 12, 31), preferences, () => false)).toEqual([])
    })
    it('all-day counts from the default time', () => {
        const allDay = makeEvent({ allDay: true, start: '2026-09-29', end: '2026-09-29', reminders: [1440] })
        expect(findDueReminders([allDay], new Date(2026, 8, 28, 9, 1), preferences, () => false)).toHaveLength(1)
    })
})
