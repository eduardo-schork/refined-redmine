import { describe, expect, it } from 'vitest'
import type { Issue } from '../redmine/entities'
import {
    EMPTY_QUICK_FILTER,
    filterOptions,
    isFilterActive,
    matchesQuickFilter,
    withQuickFilterDefaults
} from './quick-filter'

const issue = (id: number, patch: Partial<Issue> = {}): Issue => ({
    id,
    project: { id: 10, name: 'Loja Virtual' },
    tracker: { id: 1, name: 'Desenvolvimento' },
    status: { id: 2, name: 'Em andamento', is_closed: false },
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'Ana' },
    subject: `Tarefa ${id}`,
    done_ratio: 0,
    created_on: '',
    updated_on: '2026-09-30T10:00:00Z',
    ...patch
})

const issues = [
    issue(1, {
        assigned_to: { id: 7, name: 'Bia' },
        fixed_version: { id: 377, name: '3.77' },
        subject: 'Cupom de desconto'
    }),
    issue(2, { tracker: { id: 2, name: 'Negócio' }, fixed_version: { id: 377, name: '3.77' } }),
    issue(3, { status: { id: 110, name: 'Em teste', is_closed: false }, assigned_to: { id: 7, name: 'Bia' } })
]

describe('matchesQuickFilter', () => {
    it('keeps everything without filters', () => {
        expect(issues.filter((item) => matchesQuickFilter(item, EMPTY_QUICK_FILTER))).toHaveLength(3)
        expect(isFilterActive(EMPTY_QUICK_FILTER)).toBe(false)
    })

    it('combines fields (and) and values of one field (or), with "none" for missing values', () => {
        const filter = { ...EMPTY_QUICK_FILTER, versions: ['377', 'none'], assignees: ['7'] }
        expect(issues.filter((item) => matchesQuickFilter(item, filter)).map((item) => item.id)).toEqual([1, 3])
        expect(isFilterActive(filter)).toBe(true)
    })

    it('searches number, title and project without case or accents', () => {
        const byText = { ...EMPTY_QUICK_FILTER, search: 'CUPOM' }
        expect(issues.filter((item) => matchesQuickFilter(item, byText)).map((item) => item.id)).toEqual([1])
        const byNumber = { ...EMPTY_QUICK_FILTER, search: '#3' }
        expect(issues.filter((item) => matchesQuickFilter(item, byNumber)).map((item) => item.id)).toEqual([3])
    })
})

describe('filterOptions', () => {
    it('lists the values present with counts, most issues first and "none" last', () => {
        expect(filterOptions(issues, 'versions', 'Sem versão')).toEqual([
            { value: '377', label: '3.77', count: 2 },
            { value: 'none', label: 'Sem versão', count: 1 }
        ])
        expect(filterOptions(issues, 'trackers', '').map((option) => option.label)).toEqual([
            'Desenvolvimento',
            'Negócio'
        ])
    })
})

describe('withQuickFilterDefaults', () => {
    it('drops what is not a filter', () => {
        expect(withQuickFilterDefaults({ search: 3, versions: ['1', 2], other: true })).toEqual({
            ...EMPTY_QUICK_FILTER,
            versions: ['1']
        })
        expect(withQuickFilterDefaults(null)).toEqual(EMPTY_QUICK_FILTER)
    })
})
