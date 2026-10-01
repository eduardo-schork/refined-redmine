import {
    IDLE_LIMIT_SECONDS,
    elapsedHours,
    isRunning,
    pauseTimer,
    resumeTimer,
    startTimer,
    type StoppedTimer,
    type TimerState
} from '@domain/time/timer'
import type { TimerRepository } from '../ports/repositories'
import type { AppEventsPublisher, Cancel, Clock, IdleProbe, Scheduler } from '../ports/system'

/** How often the idle time is checked while the stopwatch runs. */
const IDLE_CHECK_MS = 60_000

export interface TimerDeps {
    repository: TimerRepository
    events: AppEventsPublisher
    clock: Clock
    scheduler: Scheduler
    idle: IdleProbe
}

/**
 * One stopwatch at a time, kept in the main process so it keeps counting with the window closed and survives a
 * restart (only instants are stored). It pauses when the computer sleeps or locks, and after IDLE_LIMIT_SECONDS
 * without use, not counting the idle time.
 */
export class TimerService {
    private cancelIdleCheck: Cancel | null = null

    constructor(private readonly deps: TimerDeps) {}

    /** Called once on startup: resumes the idle check of a stopwatch left running. */
    start(): void {
        this.scheduleIdleCheck()
    }

    status(): TimerState | null {
        return this.deps.repository.get()
    }

    /** Replaces any other stopwatch: the screen asks before starting a second one. */
    begin(issue: { id: number; subject: string }): TimerState {
        const timer = startTimer(issue, this.now())
        this.save(timer)
        return timer
    }

    pause(): TimerState | null {
        const timer = this.status()
        if (!timer) return null
        return this.save(pauseTimer(timer, this.now(), 'manual'))
    }

    resume(): TimerState | null {
        const timer = this.status()
        if (!timer) return null
        return this.save(resumeTimer(timer, this.now()))
    }

    /** Pauses and hands over the counted time; the stopwatch stays (paused) until it is logged or discarded. */
    stop(): StoppedTimer | null {
        const paused = this.pause()
        if (!paused) return null
        return {
            issueId: paused.issueId,
            issueSubject: paused.issueSubject,
            hours: elapsedHours(paused, this.now()),
            startedAt: paused.startedAt
        }
    }

    discard(): null {
        this.save(null)
        return null
    }

    /** The computer is going to sleep or the screen was locked. */
    onSleep(): void {
        const timer = this.status()
        if (!timer || !isRunning(timer)) return
        this.save(pauseTimer(timer, this.now(), 'sleep'))
    }

    checkIdle(): void {
        const timer = this.status()
        if (!timer || !isRunning(timer)) return
        const idleSeconds = this.deps.idle.idleSeconds()
        if (idleSeconds < IDLE_LIMIT_SECONDS) return
        const leftAt = new Date(this.now().getTime() - idleSeconds * 1000)
        this.save(pauseTimer(timer, leftAt, 'idle'))
    }

    private save(timer: TimerState | null): TimerState | null {
        this.deps.repository.save(timer)
        this.deps.events.timerChanged(timer)
        this.scheduleIdleCheck()
        return timer
    }

    private scheduleIdleCheck(): void {
        this.cancelIdleCheck?.()
        this.cancelIdleCheck = null
        const timer = this.status()
        if (!timer || !isRunning(timer)) return
        this.cancelIdleCheck = this.deps.scheduler.every(IDLE_CHECK_MS, () => this.checkIdle())
    }

    private now(): Date {
        return this.deps.clock.now()
    }
}
