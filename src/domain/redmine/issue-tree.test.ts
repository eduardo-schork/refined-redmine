import { describe, expect, it } from 'vitest'
import type { Issue, IssueDetail } from './entities'
import {
    bulkDiff,
    buildIssueTree,
    subtreeIds,
    toggleSubtree,
    treeGuides,
    treeRoots,
    unappliedFields,
    type IssueTreeNode
} from './issue-tree'

function issue(id: number, fields: Partial<Issue> = {}): Issue {
    return {
        id,
        status: { id: 1, name: 'Nova', is_closed: false },
        assigned_to: { id: 7, name: 'Lucas' },
        fixed_version: { id: 900, name: 'backlog' },
        ...fields
    } as Issue
}

const child = (id: number, parentId: number) => issue(id, { parent: { id: parentId } })

describe('treeRoots', () => {
    it('the issue, its parent and related issues (seen from the issue), once each', () => {
        const opened = {
            id: 10,
            parent: { id: 1 },
            relations: [
                { id: 1, issue_id: 30, issue_to_id: 10, relation_type: 'blocks' },
                { id: 2, issue_id: 10, issue_to_id: 1, relation_type: 'relates' }
            ]
        } as IssueDetail
        expect(treeRoots(opened)).toEqual([
            { id: 10, role: 'self' },
            { id: 1, role: 'parent' },
            { id: 30, role: 'related', relation: 'blocked' }
        ])
    })
})

describe('buildIssueTree', () => {
    const nodes = buildIssueTree(
        [
            { issue: issue(1), role: 'parent' },
            { issue: issue(10), role: 'self' }
        ],
        [child(11, 10), child(12, 11), child(10, 1), child(20, 1)]
    )
    it('puts the opened issue first, then each root with its subtasks depth first, without repeating issues', () => {
        const rows = nodes.map((node) => [node.issue.id, node.role, node.depth])
        expect(rows).toEqual([
            [10, 'self', 0],
            [11, 'subtask', 1],
            [12, 'subtask', 2],
            [1, 'parent', 0],
            [20, 'subtask', 1]
        ])
    })
    it('checking an issue checks its subtree; unchecking clears it', () => {
        expect(subtreeIds(nodes, 10)).toEqual([10, 11, 12])
        const checked = toggleSubtree(nodes, new Set(), 10)
        expect([...checked]).toEqual([10, 11, 12])
        expect([...toggleSubtree(nodes as IssueTreeNode[], checked, 11)]).toEqual([10])
    })
    it('draws the tree: last children close the branch, deeper rows keep the line of unfinished levels', () => {
        const tree = buildIssueTree([{ issue: issue(10), role: 'self' }], [child(11, 10), child(12, 11), child(13, 10)])
        expect(tree.map((node) => node.issue.id)).toEqual([10, 11, 12, 13])
        expect(treeGuides(tree)).toEqual([
            { last: true, lines: [] },
            { last: false, lines: [] },
            { last: true, lines: [true] },
            { last: true, lines: [] }
        ])
    })
})

describe('bulkDiff', () => {
    it('keeps only what differs; null clears assignee or version', () => {
        const current = issue(10)
        expect(bulkDiff(current, { statusId: 1, assignedToId: 7, fixedVersionId: 378 })).toEqual({
            fixedVersionId: 378
        })
        expect(bulkDiff(current, { assignedToId: null })).toEqual({ assignedToId: null })
        expect(bulkDiff(issue(10, { fixed_version: undefined }), { fixedVersionId: null })).toEqual({})
    })
    it('lists what Redmine did not apply', () => {
        const saved = issue(10, { fixed_version: { id: 378, name: '3.78' } })
        expect(unappliedFields({ statusId: 2, fixedVersionId: 378 }, saved)).toEqual(['statusId'])
    })
})
