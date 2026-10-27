import { describe, expect, it } from 'vitest'
import {
    elapsedHours,
    elapsedMs,
    formatClock,
    formatStopwatch,
    hoursClock,
    pauseTimer,
    resumeTimer,
    startTimer
} from './timer'

const at = (time: string) => new Date(`2026-10-01T${time}:00Z`)
const issue = { id: 1201, subject: 'CEP no checkout' }

describe('timer', () => {
    it('counts only the running time across pauses', () => {
        let timer = startTimer(issue, at('09:00'))
        timer = pauseTimer(timer, at('09:30'), 'manual')
        expect(elapsedMs(timer, at('11:00'))).toBe(30 * 60_000)
        timer = resumeTimer(timer, at('10:00'))
        expect(elapsedMs(timer, at('10:45'))).toBe(75 * 60_000)
        expect(elapsedHours(timer, at('10:45'))).toBe(1.25)
    })

    it('pauses at the moment the person left, not when it was noticed', () => {
        const timer = startTimer(issue, at('09:00'))
        const idle = pauseTimer(timer, at('09:40'), 'idle')
        expect(idle).toMatchObject({ pausedReason: 'idle', runningSince: null, accumulatedMs: 40 * 60_000 })
        expect(idle.pausedAt).toBe(at('09:40').toISOString())
    })

    it('never counts negative time and never logs zero', () => {
        const timer = startTimer(issue, at('09:00'))
        expect(pauseTimer(timer, at('08:00'), 'sleep').accumulatedMs).toBe(0)
        expect(elapsedHours(timer, at('09:00'))).toBe(0.01)
    })

    it('ignores pausing a paused timer and resuming a running one', () => {
        const running = startTimer(issue, at('09:00'))
        expect(resumeTimer(running, at('09:10'))).toBe(running)
        const paused = pauseTimer(running, at('09:20'), 'manual')
        expect(pauseTimer(paused, at('09:30'), 'idle')).toBe(paused)
    })
})

describe('hoursClock', () => {
    it('shows decimal hours as hours and minutes, rounded to the minute', () => {
        expect(hoursClock(2.83)).toBe('2:50')
        expect(hoursClock(1.5)).toBe('1:30')
        expect(hoursClock(8)).toBe('8:00')
        expect(hoursClock(0.25)).toBe('0:15')
        expect(hoursClock(-1.5)).toBe('-1:30')
        expect(hoursClock(0.001)).toBe('0:00')
    })
})

describe('formatClock', () => {
    it('shows hours and minutes', () => {
        expect(formatClock(7 * 60_000 + 59_000)).toBe('0:07')
        expect(formatClock(102 * 60_000)).toBe('1:42')
        expect(formatClock(-5)).toBe('0:00')
        expect(formatStopwatch(7 * 60_000 + 12_500)).toBe('0:07:12')
    })
})
