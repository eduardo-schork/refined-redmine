import { describe, expect, it } from 'vitest'
import { DEFAULT_ISSUE_STYLE, withIssueStyleDefaults } from './issue-style'

describe('withIssueStyleDefaults', () => {
    it('drops invalid values from the file', () => {
        const loaded = {
            statusTones: { 1: 'review', 2: 'neon', x: 'done' },
            statusColors: { 1: '#123abc', 2: 'blue' },
            priorityLevels: { 4: 'urgent', 5: 7 },
            priorityColors: { 4: '#ABCDEF', 5: '#12345' },
            dueSoonDays: 99,
            trackerColors: { 1: '#d14343', 2: 'red', x: '#000000' },
            cardAccent: 'rainbow',
            cardTint: 'yes'
        }
        expect(withIssueStyleDefaults(loaded as never)).toEqual({
            statusTones: { 1: 'review' },
            statusColors: { 1: '#123abc' },
            priorityLevels: { 4: 'urgent' },
            priorityColors: { 4: '#ABCDEF' },
            dueSoonDays: 3,
            trackerColors: { 1: '#d14343' },
            cardAccent: 'priority',
            cardTint: true
        })
    })

    it('starts empty', () => {
        expect(withIssueStyleDefaults()).toEqual(DEFAULT_ISSUE_STYLE)
    })
})
