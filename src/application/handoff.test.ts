import { describe, expect, it } from 'vitest'
import type { IssueDetail } from '@domain/redmine/entities'
import { FakeGateway } from './testing/fakes'
import { CommentAndChangeUseCase, findNearbyIssues } from './use-cases/handoff'

const status = { id: 1, name: 'Nova', is_closed: false }

function detail(id: number, trackerId: number, links: Partial<IssueDetail> = {}): IssueDetail {
    return {
        id,
        status,
        tracker: { id: trackerId, name: `T${trackerId}` },
        relations: [],
        children: [],
        ...links
    } as IssueDetail
}

function gatewayWith(...issues: IssueDetail[]) {
    const gateway = new FakeGateway()
    for (const issue of issues) gateway.details.set(issue.id, issue)
    return gateway
}

describe('findNearbyIssues', () => {
    // 1201 (dev) → parent 1000 (story) → subtask 1300 (quality); 1250 is private (cannot be read).
    const gateway = gatewayWith(
        detail(1201, 42, { parent: { id: 1000 } }),
        detail(1000, 41, { children: [{ id: 1201 }, { id: 1300 }, { id: 1250 }] as IssueDetail['children'] }),
        detail(1300, 43, { parent: { id: 1000 } })
    )
    it('walks parent, subtasks and relations closest first, skipping issues it cannot read', async () => {
        const nearby = await findNearbyIssues(gateway, 1201, [43])
        expect(nearby.map((found) => [found.issue.id, found.depth])).toEqual([
            [1000, 1],
            [1300, 2]
        ])
    })
    it('without trackers to find, stops at two links away', async () => {
        const deep = gatewayWith(
            detail(1, 1, { children: [{ id: 2 }] as IssueDetail['children'] }),
            detail(2, 1, { parent: { id: 1 }, children: [{ id: 3 }] as IssueDetail['children'] }),
            detail(3, 1, { parent: { id: 2 }, children: [{ id: 4 }] as IssueDetail['children'] }),
            detail(4, 1, { parent: { id: 3 } })
        )
        const nearby = await findNearbyIssues(deep, 1, [])
        expect(nearby.map((found) => found.issue.id)).toEqual([2, 3])
    })
})

describe('CommentAndChangeUseCase', () => {
    it('sends the comment and only the fields that differ, in one update', async () => {
        const gateway = gatewayWith(detail(1300, 43, { assigned_to: { id: 7, name: 'Lucas' } }))
        const result = await new CommentAndChangeUseCase(gateway).execute(1300, {
            notes: '  * Trâmite de desenvolvimento: #1201#note-2 ',
            assignedToId: 7,
            statusId: 2
        })
        expect(gateway.updates).toEqual([
            {
                id: 1300,
                update: { statusId: 2, notes: '* Trâmite de desenvolvimento: #1201#note-2', uploads: undefined }
            }
        ])
        expect(result).toEqual({ outcome: 'partial', ignored: ['statusId'] })
    })
    it('does nothing without a comment, files or a change', async () => {
        const gateway = gatewayWith(detail(1300, 43))
        const result = await new CommentAndChangeUseCase(gateway).execute(1300, { notes: '  ', statusId: 1 })
        expect(result.outcome).toBe('unchanged')
        expect(gateway.updates).toEqual([])
    })
})
