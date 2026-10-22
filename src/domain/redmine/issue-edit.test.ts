import { describe, expect, it } from 'vitest'
import type { IssueDetail } from './entities'
import { assertValidChange, assertValidNewIssue, ignoredFields, subtaskDefaults } from './issue-edit'

const issue = {
    id: 1,
    subject: 'Checkout: frete grátis',
    description: 'Linha 1\r\nLinha 2',
    tracker: { id: 1, name: 'Desenvolvimento' },
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
    it('the title cannot be blank nor longer than Redmine accepts', () => {
        expect(() => assertValidChange(issue, { subject: '   ' })).toThrow('issue.subjectRequired')
        expect(() => assertValidChange(issue, { subject: 'x'.repeat(256) })).toThrow('issue.subjectTooLong')
        expect(() => assertValidChange(issue, { subject: 'Novo título' })).not.toThrow()
    })
    it('the estimate cannot be negative or absurd; the parent must be another issue', () => {
        expect(() => assertValidChange(issue, { estimatedHours: -1 })).toThrow('issue.estimatedHours')
        expect(() => assertValidChange(issue, { estimatedHours: 100_000 })).toThrow('issue.estimatedHours')
        expect(() => assertValidChange(issue, { estimatedHours: null, parentIssueId: null })).not.toThrow()
        expect(() => assertValidChange(issue, { parentIssueId: 1 })).toThrow('issue.invalidParent')
        expect(() => assertValidChange(issue, { parentIssueId: 1.5 })).toThrow('issue.invalidParent')
        expect(() => assertValidChange(issue, { parentIssueId: 1201 })).not.toThrow()
    })
})

describe('assertValidNewIssue', () => {
    it('needs a project and a title, with dates in order', () => {
        expect(() => assertValidNewIssue({ projectId: 0, subject: 'Tarefa' })).toThrow('issue.projectRequired')
        expect(() => assertValidNewIssue({ projectId: 10, subject: '' })).toThrow('issue.subjectRequired')
        const reversed = { projectId: 10, subject: 'Tarefa', startDate: '2026-10-10', dueDate: '2026-10-01' }
        expect(() => assertValidNewIssue(reversed)).toThrow('issue.datesOrder')
        expect(() => assertValidNewIssue({ projectId: 10, subject: 'Tarefa' })).not.toThrow()
        expect(() => assertValidNewIssue({ projectId: 10, subject: 'Tarefa', parentIssueId: 0 })).toThrow(
            'issue.invalidParent'
        )
    })
})

describe('subtaskDefaults', () => {
    it("starts in the parent's project and version, under the parent", () => {
        const parent = { id: 1201, project: { id: 10, name: 'Loja' }, fixed_version: { id: 378, name: '3.78' } }
        expect(subtaskDefaults(parent)).toEqual({
            projectId: 10,
            fixedVersionId: 378,
            parentIssueId: 1201,
            customFields: []
        })
        expect(subtaskDefaults({ ...parent, fixed_version: undefined }).fixedVersionId).toBeUndefined()
    })
})

describe('ignoredFields', () => {
    it('lists what Redmine did not apply (read-only in the workflow)', () => {
        const saved = { ...issue, assigned_to: undefined, fixed_version: { id: 378, name: '3.78' } } as IssueDetail
        expect(ignoredFields({ assignedToId: null, fixedVersionId: 379 }, saved)).toEqual(['fixedVersionId'])
    })
    it('a description saved with other line breaks or trailing blank lines counts as applied', () => {
        expect(ignoredFields({ description: 'Linha 1\nLinha 2\n\n' }, issue)).toEqual([])
        expect(ignoredFields({ description: '' }, { ...issue, description: null } as IssueDetail)).toEqual([])
        expect(ignoredFields({ trackerId: 2, subject: 'Outro' }, issue)).toEqual(['trackerId', 'subject'])
        expect(ignoredFields({ estimatedHours: null, parentIssueId: null }, issue)).toEqual([])
    })
})
