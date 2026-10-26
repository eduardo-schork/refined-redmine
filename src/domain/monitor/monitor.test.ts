import { describe, expect, it } from 'vitest'
import type { IssueDetail, IssueStatus } from '../redmine/entities'
import { departedIds, explainQueueExit } from './queue-exit'
import { diffMembership } from './query-diff'
import {
    assertValidMonitor,
    availableEvents,
    countRuleReached,
    createMineMonitor,
    defaultEvents,
    isEventEnabled
} from './monitor'
import { isWithinSchedule } from './schedule'

const statuses = new Map<number, IssueStatus>([
    [3, { id: 3, name: 'Resolvida', is_closed: false }],
    [5, { id: 5, name: 'Finalizada', is_closed: true }]
])
const issue = (journals: IssueDetail['journals'], assigned?: { id: number; name: string }) =>
    ({
        id: 1001,
        subject: 'Ícone',
        status: { id: 5, name: 'Finalizada', is_closed: true },
        assigned_to: assigned,
        journals
    }) as IssueDetail

describe('explainQueueExit', () => {
    it('closed by someone else', () => {
        const queueExit = explainQueueExit(
            issue(
                [
                    {
                        id: 9,
                        user: { id: 8, name: 'Lucas' },
                        created_on: '',
                        details: [{ property: 'attr', name: 'status_id', old_value: '3', new_value: '5' }]
                    }
                ],
                { id: 42, name: 'Marina' }
            ),
            42,
            statuses
        )
        expect(queueExit).toMatchObject({
            causeJournalId: 9,
            actor: 'Lucas',
            reasons: [{ type: 'closed', status: 'Finalizada' }],
            byMe: false
        })
    })
    it('reassigned to someone else', () => {
        const queueExit = explainQueueExit(
            issue(
                [
                    {
                        id: 7,
                        user: { id: 8, name: 'Lucas' },
                        created_on: '',
                        details: [{ property: 'attr', name: 'assigned_to_id', old_value: '42', new_value: '754' }]
                    }
                ],
                { id: 754, name: 'Nicoly' }
            ),
            42,
            statuses
        )
        expect(queueExit.reasons).toEqual([{ type: 'reassigned', to: 'Nicoly' }])
    })
    it('recognizes when it was me', () => {
        const queueExit = explainQueueExit(
            issue([
                {
                    id: 7,
                    user: { id: 42, name: 'Marina' },
                    created_on: '',
                    details: [{ property: 'attr', name: 'status_id', old_value: '3', new_value: '5' }]
                }
            ]),
            42,
            statuses
        )
        expect(queueExit.byMe).toBe(true)
    })
    it('lists the departed ones', () => expect(departedIds([1, 2, 3], [2], 10)).toEqual([1, 3]))
})

describe('diffMembership', () => {
    const snapshot = (ids: number[], count = ids.length) => ({ count, ids })
    it('first snapshot does not alert', () => expect(diffMembership(undefined, snapshot([1, 2]))).toBeNull())
    it('lists who entered and who left', () =>
        expect(diffMembership(snapshot([1, 2]), snapshot([2, 3]))).toEqual({ from: 2, to: 2, entered: [3], left: [1] }))
    it('nothing changed', () => expect(diffMembership(snapshot([1, 2]), snapshot([2, 1]))).toBeNull())
    it('partial result: compares only the count', () =>
        expect(diffMembership(snapshot([1, 2], 900), snapshot([3, 4], 901))).toEqual({
            from: 900,
            to: 901,
            entered: [],
            left: []
        }))
})

describe('monitor events', () => {
    it('only offers events that the source can report', () => {
        expect(availableEvents('mine')).not.toContain('entered')
        expect(availableEvents('board')).toContain('left')
        const board = { ...createMineMonitor({ assigned: true, watched: true, authored: true }) }
        const onBoardSource = {
            ...board,
            source: { type: 'board' as const, boardId: 'b' },
            events: defaultEvents('mine')
        }
        expect(isEventEnabled(onBoardSource, 'new_issue')).toBe(false)
    })
    it('a monitor needs a name and a source', () => {
        const monitor = {
            id: 'x',
            name: '',
            enabled: true,
            source: { type: 'query' as const, queryId: 1 },
            events: defaultEvents('query')
        }
        expect(() => assertValidMonitor(monitor)).toThrow('monitor.nameRequired')
        expect(() => assertValidMonitor({ ...monitor, name: 'Q', source: { type: 'query', queryId: 0 } })).toThrow(
            'monitor.sourceRequired'
        )
    })
})

describe('isWithinSchedule', () => {
    const schedule = { enabled: true, weekdays: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 }
    it('respects days and hours', () => {
        expect(isWithinSchedule(schedule, new Date(2026, 8, 28, 10))).toBe(true) // Monday 10am
        expect(isWithinSchedule(schedule, new Date(2026, 8, 28, 19))).toBe(false)
        expect(isWithinSchedule(schedule, new Date(2026, 8, 27, 10))).toBe(false) // Sunday
        expect(isWithinSchedule({ ...schedule, enabled: false }, new Date(2026, 8, 27, 3))).toBe(true)
    })
})

describe('count rule', () => {
    const below2 = { op: 'below' as const, value: 2 }

    it('fires when the count starts to hold, not while it keeps holding', () => {
        expect(countRuleReached(3, 1, below2)).toBe(true)
        expect(countRuleReached(1, 0, below2)).toBe(false)
        expect(countRuleReached(1, 3, below2)).toBe(false)
        expect(countRuleReached(9, 12, { op: 'above', value: 10 })).toBe(true)
    })

    it('fires on the first check of a new monitor whose rule already holds', () => {
        expect(countRuleReached(undefined, 1, below2)).toBe(true)
        expect(countRuleReached(undefined, 2, below2)).toBe(false)
    })

    it('needs a whole number ("fewer than 0" never holds)', () => {
        const monitor = { ...createMineMonitor({ assigned: true, watched: false, authored: false }) }
        const query = { ...monitor, id: 'q', name: 'Q', source: { type: 'query' as const, queryId: 1 } }
        expect(() => assertValidMonitor({ ...query, count: { op: 'below', value: 0 } })).toThrow()
        expect(() => assertValidMonitor({ ...query, count: { op: 'above', value: 1.5 } })).toThrow()
        expect(() => assertValidMonitor({ ...query, count: { op: 'above', value: 0 } })).not.toThrow()
    })
})
