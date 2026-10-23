import { describe, expect, it } from 'vitest'
import {
    assertValidOvertime,
    bankBalance,
    lastTwelveMonths,
    overtimeMonths,
    paidHoursInYear,
    setMonthPaid,
    type OvertimeBank
} from './overtime'

const entry = (day: string, hours: number) => ({ id: day + hours, day, hours, note: '' })

const bank: OvertimeBank = {
    entries: [entry('2026-08-10', 2), entry('2026-09-03', 1.5), entry('2026-09-20', 1), entry('2026-10-01', 3)],
    paidMonths: ['2026-09']
}

describe('overtime bank', () => {
    it('the bank holds every month not paid out', () => {
        expect(bankBalance(bank)).toBe(5)
        expect(paidHoursInYear(bank, 2026)).toBe(2.5)
    })
    it('lists months oldest first with the bank at the end of each one', () => {
        expect(overtimeMonths(bank)).toEqual([
            { month: '2026-08', hours: 2, paid: false, bankAtEnd: 2 },
            { month: '2026-09', hours: 2.5, paid: true, bankAtEnd: 2 },
            { month: '2026-10', hours: 3, paid: false, bankAtEnd: 5 }
        ])
    })
    it('marks and unmarks a month as paid', () => {
        expect(setMonthPaid(bank, '2026-08', true).paidMonths).toEqual(['2026-08', '2026-09'])
        expect(setMonthPaid(bank, '2026-09', false).paidMonths).toEqual([])
    })
    it('the chart covers 12 months up to the current one, across the year', () => {
        const months = lastTwelveMonths(bank, '2026-10')
        expect(months[0].month).toBe('2025-11')
        expect(months.at(-1)).toEqual({ month: '2026-10', hours: 3, paid: false })
    })
    it('refuses hours out of range, a bad day or issue', () => {
        expect(() => assertValidOvertime({ day: '2026-10-01', hours: 0, note: '' })).toThrow('overtime.hours')
        expect(() => assertValidOvertime({ day: '01/10', hours: 1, note: '' })).toThrow('overtime.day')
        expect(() => assertValidOvertime({ day: '2026-10-01', hours: 1, issueId: 1.5, note: '' })).toThrow(
            'overtime.issue'
        )
    })
})
