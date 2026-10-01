import { describe, expect, it } from 'vitest'
import { hostOf, loginErrorCode, prepareBaseUrl } from './connection'

describe('prepareBaseUrl', () => {
    it('adds https when no scheme was typed', () => {
        expect(prepareBaseUrl(' redmine.example.com ')).toBe('https://redmine.example.com')
        expect(prepareBaseUrl('http://localhost:4567')).toBe('http://localhost:4567')
    })

    it('drops pasted Redmine pages, queries and trailing slashes', () => {
        expect(prepareBaseUrl('https://redmine.example.com/my/account')).toBe('https://redmine.example.com')
        expect(prepareBaseUrl('https://redmine.example.com/issues/1234?tab=history')).toBe(
            'https://redmine.example.com'
        )
        expect(prepareBaseUrl('https://redmine.example.com/projects/store/issues')).toBe('https://redmine.example.com')
        expect(prepareBaseUrl('https://redmine.example.com/login///')).toBe('https://redmine.example.com')
    })

    it('keeps a Redmine installed under a sub-path', () => {
        expect(prepareBaseUrl('https://example.com/redmine/')).toBe('https://example.com/redmine')
        expect(prepareBaseUrl('https://example.com/redmine/my/account')).toBe('https://example.com/redmine')
    })

    it('stays empty for an empty field', () => {
        expect(prepareBaseUrl('   ')).toBe('')
    })
})

describe('hostOf', () => {
    it('shows the host, or the text when it is not a URL', () => {
        expect(hostOf('https://redmine.example.com/redmine')).toBe('redmine.example.com')
        expect(hostOf('not a url')).toBe('not a url')
    })
})

describe('loginErrorCode', () => {
    it('explains Redmine answers in terms of the connection', () => {
        expect(loginErrorCode('redmine.unauthorized')).toBe('auth.invalidKey')
        expect(loginErrorCode('redmine.notFound')).toBe('auth.notRedmine')
        expect(loginErrorCode('redmine.invalidResponse')).toBe('auth.notRedmine')
        expect(loginErrorCode('redmine.forbidden')).toBe('auth.apiDisabled')
        expect(loginErrorCode('network.dns')).toBe('network.dns')
    })
})
