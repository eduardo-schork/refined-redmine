import { describe, expect, it } from 'vitest'
import { parseLocal } from '../shared/date'
import { countByFilter, filterNotifications, groupByDay, matchesFilter, notificationSources } from './inbox'
import type { AppNotification, NotificationKind } from './notification'

function notification(
    id: string,
    kind: NotificationKind,
    options: { at?: string; read?: boolean; monitors?: string[] } = {}
): AppNotification {
    const createdAt = parseLocal(options.at ?? '2026-10-20T10:00').toISOString()
    const sources = (options.monitors ?? []).map((monitorId) => ({ monitorId, name: monitorId.toUpperCase() }))
    return {
        id,
        kind,
        payload: { type: 'legacy', title: id, body: '' },
        target: { type: 'url', url: 'https://redmine.example/issues/1' },
        createdAt,
        read: options.read ?? false,
        sources
    }
}

describe('matchesFilter', () => {
    it('groups new issues and assignments under one chip and keeps "updated" only in "all"', () => {
        expect(matchesFilter(notification('a', 'assigned'), 'issues')).toBe(true)
        expect(matchesFilter(notification('b', 'new_issue'), 'issues')).toBe(true)
        expect(matchesFilter(notification('c', 'updated'), 'all')).toBe(true)
        expect(matchesFilter(notification('c', 'updated'), 'status')).toBe(false)
    })
})

describe('filterNotifications and countByFilter', () => {
    const items = [
        notification('mention', 'mention', { monitors: ['mine'] }),
        notification('comment', 'comment', { read: true, monitors: ['mine', 'board'] }),
        notification('query', 'query', { monitors: ['board'] }),
        notification('reminder', 'reminder')
    ]

    it('combines kind, unread and monitor', () => {
        const ids = (criteria: Parameters<typeof filterNotifications>[1]) =>
            filterNotifications(items, criteria).map((item) => item.id)
        expect(ids({ filter: 'all', onlyUnread: true })).toEqual(['mention', 'query', 'reminder'])
        expect(ids({ filter: 'all', onlyUnread: false, monitorId: 'board' })).toEqual(['comment', 'query'])
        expect(ids({ filter: 'comments', onlyUnread: true })).toEqual([])
    })

    it('counts each chip under the other criteria', () => {
        const counts = countByFilter(items, { onlyUnread: true })
        expect(counts).toMatchObject({ all: 3, mentions: 1, comments: 0, queries: 1, reminders: 1, status: 0 })
    })

    it('lists each monitor once', () => {
        expect(notificationSources(items).map((source) => source.monitorId)).toEqual(['mine', 'board'])
    })
})

describe('groupByDay', () => {
    it('groups by local day keeping the newest first', () => {
        const days = groupByDay([
            notification('late', 'comment', { at: '2026-10-22T23:50' }),
            notification('early', 'comment', { at: '2026-10-22T00:10' }),
            notification('before', 'comment', { at: '2026-10-21T18:00' })
        ])
        expect(days.map((day) => [day.date, day.items.map((item) => item.id)])).toEqual([
            ['2026-10-22', ['late', 'early']],
            ['2026-10-21', ['before']]
        ])
    })
})
