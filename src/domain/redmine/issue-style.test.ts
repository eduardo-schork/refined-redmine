import { describe, expect, it } from 'vitest'
import { withIssueStyleDefaults } from './issue-style'

describe('withIssueStyleDefaults', () => {
    it('drops invalid values from the file', () => {
        const loaded = {
            statusTones: { 1: 'review', 2: 'neon', x: 'done' },
            priorityLevels: { 4: 'urgent', 5: 7 },
            dueSoonDays: 99
        }
        expect(withIssueStyleDefaults(loaded as never)).toEqual({
            statusTones: { 1: 'review' },
            priorityLevels: { 4: 'urgent' },
            dueSoonDays: 3
        })
    })

    it('starts empty', () => {
        expect(withIssueStyleDefaults()).toEqual({ statusTones: {}, priorityLevels: {}, dueSoonDays: 3 })
    })
})
