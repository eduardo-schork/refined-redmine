import { describe, expect, it } from 'vitest'
import { issuesPageUrl, parseIssuesUrl } from './issues-url'

describe('parseIssuesUrl', () => {
    it('keeps the filter parameters and adds the project from the path', () => {
        const parsed = parseIssuesUrl(
            'https://redmine.test/projects/store/issues?set_filter=1&f[]=status_id&op[status_id]=o&page=3&per_page=50'
        )
        expect(parsed.projectRef).toBe('store')
        expect(new URLSearchParams(parsed.query).getAll('f[]')).toEqual(['status_id'])
        expect(parsed.query).not.toContain('page=')
        expect(new URLSearchParams(parsed.query).get('project_id')).toBe('store')
    })
    it('accepts a saved query address and a path without host', () =>
        expect(parseIssuesUrl('/issues?query_id=5331').query).toBe('query_id=5331'))
    it('never forwards an API key pasted by mistake', () =>
        expect(parseIssuesUrl('/issues?key=secret&status_id=*').query).toBe('status_id=*'))
    it('rejects addresses that are not an issue list', () => {
        expect(() => parseIssuesUrl('https://redmine.test/projects/store')).toThrow('filter.invalidUrl')
        expect(() => parseIssuesUrl('  ')).toThrow('filter.invalidUrl')
    })
    it('builds the web page address back', () =>
        expect(issuesPageUrl('https://r.test', { query: 'status_id=o', projectRef: 'store' })).toBe(
            'https://r.test/projects/store/issues?status_id=o'
        ))
})
