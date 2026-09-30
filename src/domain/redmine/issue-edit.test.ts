import { describe, expect, it } from 'vitest'
import type { IssueDetail } from './entities'
import { assertValidChange, ignoredFields } from './issue-edit'

const issue = {
    id: 1,
    priority: { id: 2, name: 'Normal' },
    assigned_to: { id: 7, name: 'Lucas' },
    fixed_version: { id: 378, name: '3.78' },
    start_date: '2026-10-01',
    due_date: '2026-10-10',
    done_ratio: 20
} as IssueDetail

describe('assertValidChange', () => {
    it('start after due is refused, considering the dates the issue already has', () => {
        expect(() => assertValidChange(issue, { startDate: '2026-10-11' })).toThrow('issue.datesOrder')
        expect(() => assertValidChange(issue, { dueDate: '2026-09-30' })).toThrow('issue.datesOrder')
        expect(() => assertValidChange(issue, { startDate: null, dueDate: '2026-09-30' })).not.toThrow()
    })
    it('done % must be an integer from 0 to 100', () => {
        expect(() => assertValidChange(issue, { doneRatio: 110 })).toThrow('issue.doneRatio')
        expect(() => assertValidChange(issue, { doneRatio: 50 })).not.toThrow()
    })
})

describe('ignoredFields', () => {
    it('lists what Redmine did not apply (read-only in the workflow)', () => {
        const saved = { ...issue, assigned_to: undefined, fixed_version: { id: 378, name: '3.78' } } as IssueDetail
        expect(ignoredFields({ assignedToId: null, fixedVersionId: 379 }, saved)).toEqual(['fixedVersionId'])
    })
})
