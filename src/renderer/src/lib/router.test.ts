import { describe, expect, it, vi } from 'vitest'
import { issueRoute, type AppNotification } from '@domain/notification/notification'
import { openNotification, parseIssueRoute } from './router'

const notification = (fields: Partial<AppNotification>): AppNotification => ({
    id: 'n1',
    kind: 'comment',
    payload: { type: 'legacy', title: '', body: '' },
    target: { type: 'url', url: 'https://redmine.test/issues/1201' },
    createdAt: '2026-10-05T12:00:00Z',
    read: false,
    ...fields
})

const openers = () => ({ navigate: vi.fn(), openIssue: vi.fn(), openExternal: vi.fn() })

describe('openNotification', () => {
    it('a notification about an issue opens it in the app, even when it was saved with the Redmine link', () => {
        const spies = openers()
        openNotification(notification({ issueId: 1201 }), spies)
        expect(spies.openIssue).toHaveBeenCalledWith(1201)
        expect(spies.openExternal).not.toHaveBeenCalled()
    })

    it('without an issue, the route opens in the app and a link goes to the browser', () => {
        const spies = openers()
        openNotification(notification({ target: { type: 'route', route: '/board?id=b1' } }), spies)
        expect(spies.navigate).toHaveBeenCalledWith({ page: 'board', boardId: 'b1' })
        openNotification(notification({}), spies)
        expect(spies.openExternal).toHaveBeenCalledWith('https://redmine.test/issues/1201')
    })
})

describe('parseIssueRoute', () => {
    it('reads the issue of a system notification click and ignores other routes', () => {
        expect(parseIssueRoute(issueRoute(1201))).toBe(1201)
        expect(parseIssueRoute('/issue?id=abc')).toBeUndefined()
        expect(parseIssueRoute('/board?id=1201')).toBeUndefined()
    })
})
