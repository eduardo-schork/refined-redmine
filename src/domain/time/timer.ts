/** The running (or paused) stopwatch of one issue. Times are ISO instants; durations in milliseconds. */
export interface TimerState {
    issueId: number
    issueSubject: string
    startedAt: string
    /** Time counted before the current run (earlier runs, between pauses). */
    accumulatedMs: number
    /** Start of the current run; null while paused. */
    runningSince: string | null
    pausedReason?: TimerPauseReason
    /** When a pause was not asked by the person (sleep, idle), when it happened. */
    pausedAt?: string
}

/** What the person logs when stopping: the issue and the counted hours. */
export interface StoppedTimer {
    issueId: number
    issueSubject: string
    hours: number
    startedAt: string
}

/** manual = the person paused; sleep = the computer slept or was locked; idle = no use for a while. */
export type TimerPauseReason = 'manual' | 'sleep' | 'idle'

/** After this much time without keyboard or mouse, the stopwatch pauses and does not count the idle time. */
export const IDLE_LIMIT_SECONDS = 10 * 60

export function startTimer(issue: { id: number; subject: string }, now: Date): TimerState {
    const startedAt = now.toISOString()
    return { issueId: issue.id, issueSubject: issue.subject, startedAt, accumulatedMs: 0, runningSince: startedAt }
}

export const isRunning = (timer: TimerState) => timer.runningSince !== null

export function elapsedMs(timer: TimerState, now: Date): number {
    if (!timer.runningSince) return timer.accumulatedMs
    const currentRun = Math.max(0, now.getTime() - new Date(timer.runningSince).getTime())
    return timer.accumulatedMs + currentRun
}

/** `at` is when the time stopped counting: for idle it is when the person left, not when it was noticed. */
export function pauseTimer(timer: TimerState, at: Date, reason: TimerPauseReason): TimerState {
    if (!timer.runningSince) return timer
    const runStart = new Date(timer.runningSince).getTime()
    const stoppedAt = Math.max(runStart, at.getTime())
    const accumulatedMs = timer.accumulatedMs + (stoppedAt - runStart)
    const pausedAt = new Date(stoppedAt).toISOString()
    return { ...timer, accumulatedMs, runningSince: null, pausedReason: reason, pausedAt }
}

export function resumeTimer(timer: TimerState, now: Date): TimerState {
    if (timer.runningSince) return timer
    return { ...timer, runningSince: now.toISOString(), pausedReason: undefined, pausedAt: undefined }
}

/** Hours with two decimals, at least 0.01 h (Redmine refuses 0). */
export function elapsedHours(timer: TimerState, now: Date): number {
    const hours = elapsedMs(timer, now) / 3_600_000
    return Math.max(0.01, Math.round(hours * 100) / 100)
}

/** "0:07", "1:42", "12:05": hours and minutes, for the tray and the sidebar. */
export function formatClock(ms: number): string {
    const totalMinutes = Math.floor(Math.max(0, ms) / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}:${String(minutes).padStart(2, '0')}`
}

/** "0:07:12": with seconds, for the stopwatch on screen. */
export function formatStopwatch(ms: number): string {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
    const seconds = totalSeconds % 60
    return `${formatClock(totalSeconds * 1000)}:${String(seconds).padStart(2, '0')}`
}
