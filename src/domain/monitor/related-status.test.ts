import { describe, expect, it } from 'vitest'
import {
    emptyWatch,
    issuesLinkedTo,
    linksToRefresh,
    pruneWatch,
    relatedMarks,
    relatedStatusChanges,
    watchFor,
    withLinks,
    withRelatedSeen,
    type RelatedWatch
} from './related-status'

const QUALITY = 4
const FINISHED = 5
const REJECTED = 6
const NEW = 1
const rule = { trackerId: QUALITY, statusIds: [FINISHED, REJECTED] }
const now = new Date('2026-11-19T12:00:00Z')

const watch: RelatedWatch = {
    trackerId: QUALITY,
    links: {
        1213: { relatedIds: [1220], checkedAt: '2026-11-19T10:00:00Z', issueUpdatedOn: '2026-11-18T10:00:00Z' },
        1206: { relatedIds: [], checkedAt: '2026-11-19T02:00:00Z' }
    },
    related: { 1220: { statusId: NEW, subject: 'QA: endereço' } }
}

describe('related-status watch', () => {
    it('starts over when the rule asks for another tracker', () => {
        expect(watchFor(watch, rule)).toBe(watch)
        expect(watchFor(watch, { ...rule, trackerId: 9 })).toEqual(emptyWatch(9))
        expect(watchFor(undefined, rule)).toEqual(emptyWatch(QUALITY))
    })

    it('looks for links of new, changed and old issues; never looked for first', () => {
        const sourceIssues = [
            { id: 1213, updatedOn: '2026-11-18T10:00:00Z' },
            { id: 1206 },
            { id: 1230, updatedOn: '2026-11-19T11:00:00Z' }
        ]
        expect(linksToRefresh(watch, sourceIssues, now)).toEqual([1230, 1206])
        const changed = [{ id: 1213, updatedOn: '2026-11-19T11:30:00Z' }]
        expect(linksToRefresh(watch, changed, now)).toEqual([1213])
    })

    it('forgets issues that left the source and related issues no longer linked', () => {
        const pruned = pruneWatch(watch, [1206])
        expect(Object.keys(pruned.links)).toEqual(['1206'])
        expect(pruned.related).toEqual({})
    })

    it('reports only a change into one of the statuses, not the first sight', () => {
        const current = [
            { id: 1220, statusId: REJECTED, subject: 'QA: endereço' },
            { id: 1221, statusId: FINISHED, subject: 'QA: novo' }
        ]
        const linkedBoth = withLinks(watch, 1206, { relatedIds: [1221], checkedAt: now.toISOString() })
        expect(relatedStatusChanges(linkedBoth, current, rule)).toEqual([
            { relatedId: 1220, fromStatusId: NEW, toStatusId: REJECTED }
        ])
        const seen = withRelatedSeen(linkedBoth, current)
        expect(relatedStatusChanges(seen, current, rule)).toEqual([])
        const reopened = [{ id: 1220, statusId: NEW, subject: 'QA: endereço' }]
        expect(relatedStatusChanges(seen, reopened, rule)).toEqual([])
    })

    it('finds the issues linked to a related issue and the marks for the cards', () => {
        expect(issuesLinkedTo(watch, 1220)).toEqual([1213])
        expect(relatedMarks(watch, rule)).toEqual([])
        const rejected = withRelatedSeen(watch, [{ id: 1220, statusId: REJECTED, subject: 'QA: endereço' }])
        expect(relatedMarks(rejected, rule)).toEqual([
            { issueId: 1213, relatedId: 1220, relatedSubject: 'QA: endereço', trackerId: QUALITY, statusId: REJECTED }
        ])
    })
})
