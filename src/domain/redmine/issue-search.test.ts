import { describe, expect, it } from 'vitest'
import { parseIssueSearch, titleSearchQuery } from './issue-search'

describe('parseIssueSearch', () => {
    it('a number, with or without #, is an issue id', () => {
        expect(parseIssueSearch('#1203')).toEqual({ type: 'id', id: 1203 })
        expect(parseIssueSearch(' 42 ')).toEqual({ type: 'id', id: 42 })
    })
    it('text needs at least two characters', () => {
        expect(parseIssueSearch('a')).toEqual({ type: 'empty' })
        expect(parseIssueSearch('  cupom ')).toEqual({ type: 'text', term: 'cupom' })
    })
})

describe('titleSearchQuery', () => {
    it('uses the f[]/op[]/v[] form for both the status and the title', () => {
        const query = new URLSearchParams(titleSearchQuery('cep checkout'))
        expect(query.getAll('f[]')).toEqual(['status_id', 'subject'])
        expect(query.get('op[status_id]')).toBe('*')
        expect(query.get('op[subject]')).toBe('~')
        expect(query.getAll('v[subject][]')).toEqual(['cep checkout'])
    })
})
