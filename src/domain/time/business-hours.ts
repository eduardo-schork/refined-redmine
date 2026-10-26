/** One stretch of the working day, 'HH:mm' to 'HH:mm' (end not included). */
export interface WorkPeriod {
    start: string
    end: string
}

/** Working hours used to split the time counted for a trâmite into normal hours and overtime. */
export interface WorkSchedule {
    /** 0 = Sunday … 6 = Saturday. */
    weekdays: number[]
    periods: WorkPeriod[]
}

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
    weekdays: [1, 2, 3, 4, 5],
    periods: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
    ]
}

export interface WorkTimeSplit {
    /** Inside the work periods. */
    business: number
    /** Outside them (nights, weekends, after hours). */
    overtime: number
}

const MINUTE_MS = 60_000
const TIME = /^(\d{1,2}):(\d{2})$/

function minutesOfDay(time: string): number | undefined {
    const match = TIME.exec(time)
    if (!match) return undefined
    return Number(match[1]) * 60 + Number(match[2])
}

/** The day's periods in minutes, sorted and merged, so overlapping periods never count twice. */
function dayIntervals(schedule: WorkSchedule): [number, number][] {
    const intervals: [number, number][] = []
    for (const period of schedule.periods) {
        const start = minutesOfDay(period.start)
        const end = minutesOfDay(period.end)
        if (start !== undefined && end !== undefined && end > start) intervals.push([start, end])
    }
    intervals.sort((first, second) => first[0] - second[0])
    const merged: [number, number][] = []
    for (const [start, end] of intervals) {
        const last = merged[merged.length - 1]
        if (last && start <= last[1]) last[1] = Math.max(last[1], end)
        else merged.push([start, end])
    }
    return merged
}

const toHours = (milliseconds: number) => Math.round((milliseconds / 3_600_000) * 100) / 100

/**
 * Time from `since` to `now`, as in the redmine-adapter: what falls inside the work periods is normal time, the
 * break between two periods of a work day (lunch) counts as neither, and the rest (nights, weekends) is overtime.
 */
export function splitWorkTime(since: Date, now: Date, schedule: WorkSchedule): WorkTimeSplit {
    if (now <= since) return { business: 0, overtime: 0 }
    const intervals = dayIntervals(schedule)
    let business = 0
    let pause = 0
    const overlap = (day: Date, startMinute: number, endMinute: number) => {
        const start = Math.max(day.getTime() + startMinute * MINUTE_MS, since.getTime())
        const end = Math.min(day.getTime() + endMinute * MINUTE_MS, now.getTime())
        return Math.max(0, end - start)
    }
    const firstDay = new Date(since.getFullYear(), since.getMonth(), since.getDate())
    for (let day = firstDay; day < now; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
        if (!schedule.weekdays.includes(day.getDay())) continue
        intervals.forEach(([start, end], index) => {
            business += overlap(day, start, end)
            if (index > 0) pause += overlap(day, intervals[index - 1][1], start)
        })
    }
    const total = now.getTime() - since.getTime()
    return { business: toHours(business), overtime: toHours(total - business - pause) }
}
