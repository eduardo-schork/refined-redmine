/** Time window in which the monitor runs. */
export interface Schedule {
    enabled: boolean
    weekdays: number[] // 1 = Monday … 7 = Sunday
    startHour: number
    endHour: number
}

export function isWithinSchedule(schedule: Schedule, now: Date): boolean {
    if (!schedule.enabled) return true
    const weekday = now.getDay() === 0 ? 7 : now.getDay()
    if (!schedule.weekdays.includes(weekday)) return false
    const hour = now.getHours()
    const crossesMidnight = schedule.startHour > schedule.endHour
    if (crossesMidnight) return hour >= schedule.startHour || hour < schedule.endHour
    return hour >= schedule.startHour && hour < schedule.endHour
}
