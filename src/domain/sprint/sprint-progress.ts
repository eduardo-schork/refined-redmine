import type { Issue } from '../redmine/entities'
import { addDays, daysBetween, daysUntil, parseLocal, startOfDay } from '../shared/date'
import type { Sprint } from './sprint'

/** Closed share compared with the share of the dev period already gone. */
export type SprintPace = 'ahead' | 'onTrack' | 'behind'

/** Percentage points of difference still counted as "on track". */
export const PACE_TOLERANCE = 15

export interface SprintProgress {
    daysToDevDeadline?: number
    daysToRelease?: number
    /** Share of the dev period already gone, 0–100; needs the estimated start and the dev deadline. */
    elapsedPercent?: number
    closedPercent: number
    /** Only while the sprint is in development and the period is known. */
    pace?: SprintPace
    open: number
    /** Monday to Friday, from today to the dev deadline, both included. Only before the deadline. */
    workingDaysLeft?: number
    /** Open issues to close per working day to finish by the dev deadline. */
    openPerWorkingDay?: number
    /** Issues created after the estimated start: scope added during the sprint. */
    addedAfterStart?: number
    /** Estimated hours of the open issues. */
    remainingEstimate: number
    /** Issues closed in the last 7 days: the recent pace of the team. */
    closedLastWeek: number
}

const RECENT_DAYS = 7

const SATURDAY = 6
const SUNDAY = 0

export function workingDaysBetween(from: Date, to: Date): number {
    let count = 0
    for (let day = startOfDay(from); day <= startOfDay(to); day = addDays(day, 1)) {
        const weekday = day.getDay()
        if (weekday !== SATURDAY && weekday !== SUNDAY) count += 1
    }
    return count
}

function elapsedPercent(sprint: Sprint, today: Date): number | undefined {
    if (!sprint.devStart || !sprint.devDeadline) return undefined
    const start = parseLocal(sprint.devStart)
    const totalDays = daysBetween(start, parseLocal(sprint.devDeadline)) + 1
    if (totalDays <= 0) return undefined
    const goneDays = daysBetween(start, today) + 1
    const percent = Math.round((goneDays / totalDays) * 100)
    return Math.min(100, Math.max(0, percent))
}

function paceOf(closedPercent: number, elapsed: number): SprintPace {
    if (closedPercent < elapsed - PACE_TOLERANCE) return 'behind'
    if (closedPercent > elapsed + PACE_TOLERANCE) return 'ahead'
    return 'onTrack'
}

function workingDaysLeft(sprint: Sprint, today: Date): number | undefined {
    if (!sprint.devDeadline || daysUntil(sprint.devDeadline, today) < 0) return undefined
    return workingDaysBetween(today, parseLocal(sprint.devDeadline))
}

function addedAfterStart(sprint: Sprint, issues: Issue[]): number | undefined {
    if (!sprint.devStart) return undefined
    const start = parseLocal(sprint.devStart)
    return issues.filter((issue) => new Date(issue.created_on) >= start).length
}

function closedRecently(issues: Issue[], today: Date): number {
    const since = addDays(startOfDay(today), -RECENT_DAYS)
    const closedSince = (issue: Issue) =>
        issue.status.is_closed && issue.closed_on && new Date(issue.closed_on) >= since
    return issues.filter(closedSince).length
}

/** Where a sprint stands: time left, pace against the calendar and work left. */
export function sprintProgress(sprint: Sprint, issues: Issue[], today: Date): SprintProgress {
    const openIssues = issues.filter((issue) => !issue.status.is_closed)
    const closedPercent = issues.length ? Math.round(((issues.length - openIssues.length) / issues.length) * 100) : 0
    const elapsed = elapsedPercent(sprint, today)
    const inDevelopment = sprint.phase === 'dev' && elapsed !== undefined
    const daysLeft = workingDaysLeft(sprint, today)
    const hasDaysLeft = daysLeft !== undefined && daysLeft > 0
    return {
        daysToDevDeadline: sprint.devDeadline ? daysUntil(sprint.devDeadline, today) : undefined,
        daysToRelease: sprint.release ? daysUntil(sprint.release, today) : undefined,
        elapsedPercent: elapsed,
        closedPercent,
        pace: inDevelopment ? paceOf(closedPercent, elapsed) : undefined,
        open: openIssues.length,
        workingDaysLeft: daysLeft,
        openPerWorkingDay: hasDaysLeft ? Math.round((openIssues.length / daysLeft) * 10) / 10 : undefined,
        addedAfterStart: addedAfterStart(sprint, issues),
        remainingEstimate: openIssues.reduce((sum, issue) => sum + (issue.estimated_hours ?? 0), 0),
        closedLastWeek: closedRecently(issues, today)
    }
}
