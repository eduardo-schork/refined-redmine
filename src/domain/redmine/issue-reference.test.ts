import { describe, expect, it } from 'vitest'
import { linkIssueReferences } from './issue-reference'

describe('linkIssueReferences', () => {
    it('links issues and their notes', () => {
        expect(linkIssueReferences('Ver #1234')).toBe('Ver [#1234](/issues/1234)')
        expect(linkIssueReferences('Ver #1234#note-5.')).toBe('Ver [#1234#note-5](/issues/1234#note-5).')
        expect(linkIssueReferences('(#1234-5)')).toBe('([#1234-5](/issues/1234#note-5))')
    })

    it('links notes of the current issue only when it is known', () => {
        expect(linkIssueReferences('#note-3 e #1234#note-5', 77)).toBe(
            '[#note-3](/issues/77#note-3) e [#1234#note-5](/issues/1234#note-5)'
        )
        expect(linkIssueReferences('#note-3')).toBe('#note-3')
    })

    it('leaves short numbers and words alone', () => {
        expect(linkIssueReferences('item #12 e abc#1234')).toBe('item #12 e abc#1234')
    })
})
