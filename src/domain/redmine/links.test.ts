import { describe, expect, it } from 'vitest'
import { appLinkTarget, RedmineLinks } from './links'

const links = new RedmineLinks('https://redmine.example.com/')
const appLink = (redmineUrl: string) => `refined-redmine://open?url=${encodeURIComponent(redmineUrl)}`

describe('RedmineLinks.resolve', () => {
    it('reads the issue and the note of a link', () => {
        expect(links.resolve('/issues/1234')).toEqual({ url: 'https://redmine.example.com/issues/1234', issueId: 1234 })
        expect(links.resolve('https://redmine.example.com/issues/1234?tab=notes#note-5')).toMatchObject({
            issueId: 1234,
            note: 5
        })
        expect(links.resolve('/issues/1234#change-99')).toMatchObject({ issueId: 1234, note: undefined })
    })

    it('ignores other paths and other sites', () => {
        expect(links.resolve('/projects/site/issues').issueId).toBeUndefined()
        expect(links.resolve('https://github.com/owner/repo/issues/12').issueId).toBeUndefined()
        expect(links.resolve('https://redmine.example.com.evil.test/issues/1').issueId).toBeUndefined()
    })

    it('builds the link of a note', () => {
        expect(links.note(1234, 5)).toBe('https://redmine.example.com/issues/1234#note-5')
    })
})

describe('appLinkTarget', () => {
    it('opens issues of the configured Redmine, at the note', () => {
        expect(appLinkTarget(appLink('https://redmine.example.com/issues/1234#note-5'), links)).toEqual({
            issueId: 1234,
            note: 5
        })
        expect(appLinkTarget(appLink('https://redmine.example.com/issues/1234'), links)?.issueId).toBe(1234)
    })

    it('ignores anything else', () => {
        expect(appLinkTarget(appLink('https://other.example.com/issues/1234'), links)).toBeUndefined()
        expect(appLinkTarget(appLink('https://redmine.example.com/projects/site'), links)).toBeUndefined()
        expect(appLinkTarget(appLink('javascript:alert(1)'), links)).toBeUndefined()
        expect(appLinkTarget('refined-redmine://settings?url=x', links)).toBeUndefined()
        expect(appLinkTarget('https://redmine.example.com/issues/1234', links)).toBeUndefined()
        expect(appLinkTarget('not a url', links)).toBeUndefined()
        expect(appLinkTarget(appLink('https://redmine.example.com/issues/1'), new RedmineLinks(''))).toBeUndefined()
    })
})
