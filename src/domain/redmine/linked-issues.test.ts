import { describe, expect, it } from 'vitest'
import type { Issue, IssueDetail, Relation } from './entities'
import { closedSubtaskCount, linkedIssueIds, relationGroups } from './linked-issues'

const relation = (id: number, from: number, to: number, type: string): Relation => ({
    id,
    issue_id: from,
    issue_to_id: to,
    relation_type: type
})

const detail = (patch: Partial<IssueDetail>) => ({ id: 100, children: [], relations: [], ...patch }) as IssueDetail

const withStatus = (id: number, isClosed: boolean) =>
    ({ id, status: { id: isClosed ? 5 : 1, name: '', is_closed: isClosed } }) as Issue

describe('relationGroups', () => {
    it('groups by type seen from the issue, blockers first', () => {
        const groups = relationGroups(100, [
            relation(1, 100, 201, 'relates'),
            relation(2, 202, 100, 'blocks'),
            relation(3, 100, 203, 'relates'),
            relation(4, 100, 204, 'precedes')
        ])

        expect(groups).toEqual([
            { type: 'blocked', issueIds: [202] },
            { type: 'precedes', issueIds: [204] },
            { type: 'relates', issueIds: [201, 203] }
        ])
    })

    it('keeps unknown types at the end and drops repeated issues', () => {
        const groups = relationGroups(100, [
            relation(1, 100, 201, 'custom'),
            relation(2, 100, 202, 'relates'),
            relation(3, 202, 100, 'relates')
        ])

        expect(groups.map((group) => group.type)).toEqual(['relates', 'custom'])
        expect(groups[0].issueIds).toEqual([202])
    })
})

describe('linkedIssueIds', () => {
    it('lists subtasks and related issues once each', () => {
        const issue = detail({
            children: [{ id: 301, tracker: { id: 1, name: 'Dev' }, subject: 'A' }],
            relations: [relation(1, 100, 301, 'relates'), relation(2, 302, 100, 'blocks')]
        })

        expect(linkedIssueIds(issue)).toEqual([301, 302])
    })
})

describe('closedSubtaskCount', () => {
    it('counts only loaded subtasks that are closed', () => {
        const tracker = { id: 1, name: 'Dev' }
        const issue = detail({
            children: [
                { id: 301, tracker, subject: 'A' },
                { id: 302, tracker, subject: 'B' },
                { id: 303, tracker, subject: 'C' }
            ]
        })
        const loaded = new Map([
            [301, withStatus(301, true)],
            [302, withStatus(302, false)]
        ])

        expect(closedSubtaskCount(issue, loaded)).toBe(1)
    })
})
