import { describe, expect, it } from 'vitest'
import { assertValidDraft, defaultActivityId, parseHours } from './time-entry'

describe('parseHours', () => {
    it('reads the usual ways of typing a duration', () => {
        expect(parseHours('1,5')).toBe(1.5)
        expect(parseHours('1.25')).toBe(1.25)
        expect(parseHours('2h')).toBe(2)
        expect(parseHours('2 h')).toBe(2)
        expect(parseHours('1:30')).toBe(1.5)
        expect(parseHours('1h30')).toBe(1.5)
        expect(parseHours('1h 30m')).toBe(1.5)
        expect(parseHours('0h45min')).toBe(0.75)
        expect(parseHours('90m')).toBe(1.5)
        expect(parseHours('20 min')).toBe(0.33)
    })

    it('refuses what is not a duration', () => {
        expect(parseHours('')).toBeNull()
        expect(parseHours('abc')).toBeNull()
        expect(parseHours('1:75')).toBeNull()
        expect(parseHours('-1')).toBeNull()
    })
})

describe('assertValidDraft', () => {
    const draft = { issueId: 1201, spentOn: '2026-09-30', hours: 1.5, comments: 'Revisão do layout' }

    it('accepts any real date and up to 24 h', () => {
        expect(() => assertValidDraft(draft)).not.toThrow()
        expect(() => assertValidDraft({ ...draft, spentOn: '2020-01-31', hours: 24 })).not.toThrow()
    })

    it('refuses zero or too many hours, a bad date, an empty comment or no issue', () => {
        expect(() => assertValidDraft({ ...draft, hours: 0 })).toThrow(expect.objectContaining({ code: 'time.hours' }))
        expect(() => assertValidDraft({ ...draft, hours: 25 })).toThrow(expect.objectContaining({ code: 'time.hours' }))
        expect(() => assertValidDraft({ ...draft, spentOn: '2026-02-30' })).toThrow(
            expect.objectContaining({ code: 'time.date' })
        )
        expect(() => assertValidDraft({ ...draft, comments: '   ' })).toThrow(
            expect.objectContaining({ code: 'time.comment' })
        )
        expect(() => assertValidDraft({ ...draft, issueId: 0 })).toThrow(
            expect.objectContaining({ code: 'time.issue' })
        )
    })
})

describe('defaultActivityId', () => {
    const activities = [
        { id: 8, name: 'Análise' },
        { id: 9, name: 'Desenvolvimento', is_default: true },
        { id: 10, name: 'Reunião' }
    ]

    it('prefers the last used, then the Redmine default, then the first', () => {
        expect(defaultActivityId(activities, 10)).toBe(10)
        expect(defaultActivityId(activities, 99)).toBe(9)
        expect(defaultActivityId([{ id: 3, name: 'Única' }])).toBe(3)
        expect(defaultActivityId([])).toBeUndefined()
    })
})
