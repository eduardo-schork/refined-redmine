import { AppError } from '../shared/errors'
import type { LocalDate } from '../shared/date'

/** Overtime kept only in the app (Redmine has no such concept): hours worked beyond the business hours. */
export interface OvertimeEntry {
    id: string
    day: LocalDate
    hours: number
    issueId?: number
    note: string
}

export type OvertimeDraft = Omit<OvertimeEntry, 'id'>

/** `paidMonths` ("YYYY-MM"): months paid out; the others stay in the bank. */
export interface OvertimeBank {
    entries: OvertimeEntry[]
    paidMonths: string[]
}

export const EMPTY_BANK: OvertimeBank = { entries: [], paidMonths: [] }

const MAX_HOURS_PER_ENTRY = 24
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

export const monthOf = (day: LocalDate) => day.slice(0, 7)

export function assertValidOvertime(draft: OvertimeDraft): void {
    const validHours = Number.isFinite(draft.hours) && draft.hours > 0 && draft.hours <= MAX_HOURS_PER_ENTRY
    if (!validHours) throw new AppError('overtime.hours', { max: MAX_HOURS_PER_ENTRY })
    if (!DAY.test(draft.day)) throw new AppError('overtime.day')
    const validIssue = draft.issueId === undefined || (Number.isInteger(draft.issueId) && draft.issueId > 0)
    if (!validIssue) throw new AppError('overtime.issue')
}

export function assertValidMonth(month: string): void {
    if (!MONTH.test(month)) throw new AppError('overtime.month')
}

export interface OvertimeMonth {
    month: string
    hours: number
    paid: boolean
    /** Unpaid hours accumulated up to the end of this month. */
    bankAtEnd: number
}

const roundHours = (hours: number) => Math.round(hours * 100) / 100

/** Months with overtime, oldest first, with the bank as it stood at the end of each one. */
export function overtimeMonths(bank: OvertimeBank): OvertimeMonth[] {
    const totals = new Map<string, number>()
    for (const entry of bank.entries) {
        const month = monthOf(entry.day)
        totals.set(month, (totals.get(month) ?? 0) + entry.hours)
    }
    const paid = new Set(bank.paidMonths)
    let running = 0
    return [...totals.keys()].sort().map((month) => {
        const hours = roundHours(totals.get(month) ?? 0)
        if (!paid.has(month)) running = roundHours(running + hours)
        return { month, hours, paid: paid.has(month), bankAtEnd: running }
    })
}

/** Hours in the bank: overtime of every month not paid out. */
export function bankBalance(bank: OvertimeBank): number {
    const paid = new Set(bank.paidMonths)
    const unpaid = bank.entries.filter((entry) => !paid.has(monthOf(entry.day)))
    return roundHours(unpaid.reduce((sum, entry) => sum + entry.hours, 0))
}

export function hoursInMonth(bank: OvertimeBank, month: string): number {
    const entries = bank.entries.filter((entry) => monthOf(entry.day) === month)
    return roundHours(entries.reduce((sum, entry) => sum + entry.hours, 0))
}

export function paidHoursInYear(bank: OvertimeBank, year: number): number {
    const months = overtimeMonths(bank).filter((month) => month.paid && month.month.startsWith(`${year}-`))
    return roundHours(months.reduce((sum, month) => sum + month.hours, 0))
}

/** The last 12 months up to `month` ("YYYY-MM"), oldest first, for the chart (months without overtime are 0). */
export function lastTwelveMonths(bank: OvertimeBank, month: string): { month: string; hours: number; paid: boolean }[] {
    const [year, monthNumber] = month.split('-').map(Number)
    const paid = new Set(bank.paidMonths)
    return Array.from({ length: 12 }, (_, index) => {
        const date = new Date(year, monthNumber - 1 - (11 - index), 1)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return { month: key, hours: hoursInMonth(bank, key), paid: paid.has(key) }
    })
}

export function setMonthPaid(bank: OvertimeBank, month: string, paid: boolean): OvertimeBank {
    const others = bank.paidMonths.filter((candidate) => candidate !== month)
    return { ...bank, paidMonths: paid ? [...others, month].sort() : others }
}
