import { describe, expect, it } from 'vitest'
import { DEFAULT_WORK_SCHEDULE, splitWorkTime } from './business-hours'

// 2026-10-26 is a Monday.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute)

describe('splitWorkTime', () => {
    it('counts the morning and the afternoon, but not lunch', () => {
        expect(splitWorkTime(at(26, 10), at(26, 15), DEFAULT_WORK_SCHEDULE)).toEqual({ business: 4, overtime: 0 })
    })

    it('after hours is overtime', () => {
        expect(splitWorkTime(at(26, 17), at(26, 19, 30), DEFAULT_WORK_SCHEDULE)).toEqual({
            business: 1,
            overtime: 1.5
        })
    })

    it('a weekend is all overtime', () => {
        expect(splitWorkTime(at(25, 9), at(25, 11), DEFAULT_WORK_SCHEDULE)).toEqual({ business: 0, overtime: 2 })
    })

    it('nothing when the start is not before now', () => {
        expect(splitWorkTime(at(26, 10), at(26, 10), DEFAULT_WORK_SCHEDULE)).toEqual({ business: 0, overtime: 0 })
    })

    it('ignores invalid periods and merges overlapping ones', () => {
        const schedule = {
            weekdays: [1],
            periods: [
                { start: '08:00', end: '12:00' },
                { start: '11:00', end: '13:00' },
                { start: '18:00', end: '09:00' }
            ]
        }
        expect(splitWorkTime(at(26, 8), at(26, 13), schedule)).toEqual({ business: 5, overtime: 0 })
    })
})
