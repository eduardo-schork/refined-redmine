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
    it('reads up to four issues of one depth at the same time, keeping their order', async () => {
        const childIds = [11, 12, 13, 14, 15, 16]
        const slow = new SlowGateway()
        slow.details.set(1, detail(1, 1, { children: childIds.map((id) => ({ id })) as IssueDetail['children'] }))
        for (const id of childIds) slow.details.set(id, detail(id, 2, { parent: { id: 1 } }))
        const nearby = await findNearbyIssues(slow, 1, [])
        expect(nearby.map((found) => found.issue.id)).toEqual(childIds)
        expect(slow.mostAtOnce).toBe(4)
    })
})

/** Answers on the next tick and counts the reads in progress. */
class SlowGateway extends FakeGateway {
    inProgress = 0
    mostAtOnce = 0

    override async getIssue(id: number) {
        this.inProgress += 1
        this.mostAtOnce = Math.max(this.mostAtOnce, this.inProgress)
        await new Promise((resolve) => setTimeout(resolve, 1))
        this.inProgress -= 1
        return super.getIssue(id)
    }
}

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
    it('goes through the statuses on the way first; the comment goes with the final status', async () => {
        const gateway = gatewayWith(detail(1300, 43, { status: { id: 12, name: 'Em pausa', is_closed: false } }))
        await new CommentAndChangeUseCase(gateway).execute(1300, { notes: 'ok', statusId: 1, viaStatusIds: [2, 12, 3] })
        expect(gateway.updates).toEqual([
            { id: 1300, update: { statusId: 3 } },
            { id: 1300, update: { statusId: 1, notes: 'ok', uploads: undefined } }
        ])
    })
    it('already in the final status, only the comment', async () => {
        const gateway = gatewayWith(detail(1300, 43))
        await new CommentAndChangeUseCase(gateway).execute(1300, { notes: 'ok', statusId: 1, viaStatusIds: [12] })
        expect(gateway.updates).toEqual([{ id: 1300, update: { notes: 'ok', uploads: undefined } }])
    })
})
