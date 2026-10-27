import { describe, expect, it } from 'vitest'
import type { Issue, IssueDetail } from '@domain/redmine/entities'
import { FakeGateway } from './testing/fakes'
import { BulkEditUseCase, loadIssueTree } from './use-cases/issue-tree'

const status = { id: 1, name: 'Nova', is_closed: false }

function detail(id: number, fields: Partial<IssueDetail> = {}): IssueDetail {
    return { id, status, relations: [], subject: `#${id}`, ...fields } as IssueDetail
}

const listed = (id: number, parentId?: number) =>
    ({ id, status, subject: `#${id}`, parent: parentId ? { id: parentId } : undefined }) as Issue

const rawQuery = (params: Record<string, string>) =>
    JSON.stringify({ rawQuery: new URLSearchParams(params).toString() })

describe('loadIssueTree', () => {
    it('reads the roots in one listing and the subtasks level by level', async () => {
        const gateway = new FakeGateway()
        gateway.details.set(10, detail(10, { parent: { id: 1 } }))
        gateway.byFilter.set(rawQuery({ issue_id: '10,1', status_id: '*' }), [listed(10, 1), listed(1)])
        gateway.byFilter.set(rawQuery({ parent_id: '10,1', status_id: '*' }), [listed(11, 10), listed(10, 1)])
        gateway.byFilter.set(rawQuery({ parent_id: '11', status_id: '*' }), [])
        const tree = await loadIssueTree(gateway, 10)
        expect(tree.map((node) => [node.issue.id, node.role, node.depth])).toEqual([
            [10, 'self', 0],
            [11, 'subtask', 1],
            [1, 'parent', 0]
        ])
        expect(gateway.filters).toHaveLength(3)
    })
})

describe('BulkEditUseCase', () => {
    it('sends only what differs and reports what Redmine ignored', async () => {
        const gateway = new FakeGateway()
        gateway.details.set(10, detail(10, { fixed_version: { id: 900, name: 'backlog' } }))
        const result = await new BulkEditUseCase(gateway).execute(10, { statusId: 2, fixedVersionId: 900 })
        expect(gateway.updates).toEqual([{ id: 10, update: { statusId: 2 } }])
        expect(result).toEqual({ outcome: 'partial', ignored: ['statusId'] })
    })
    it('does not touch an issue that already has the values', async () => {
        const gateway = new FakeGateway()
        gateway.details.set(10, detail(10))
        const result = await new BulkEditUseCase(gateway).execute(10, { statusId: 1 })
        expect(result.outcome).toBe('unchanged')
        expect(gateway.updates).toEqual([])
    })
    it('goes through the statuses on the way, one update each, before the final status', async () => {
        const gateway = new FakeGateway()
        gateway.details.set(10, detail(10, { status: { id: 2, name: 'Em andamento', is_closed: false } }))
        await new BulkEditUseCase(gateway).execute(10, { statusId: 5, viaStatusIds: [12, 3] })
        expect(gateway.updates).toEqual([
            { id: 10, update: { statusId: 12 } },
            { id: 10, update: { statusId: 3 } },
            { id: 10, update: { statusId: 5 } }
        ])
    })
})
