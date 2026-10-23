import { describe, expect, it } from 'vitest'
import type { CustomFieldValue, Issue } from './entities'
import { customFieldEntries, inheritedCustomFields, projectCustomFields, trackerCustomFields } from './custom-fields'

const development = { id: 1, name: 'Desenvolvimento' }
const bug = { id: 2, name: 'Defeito' }

function issue(tracker: Issue['tracker'], module: string, requester: string, extra: CustomFieldValue[] = []): Issue {
    const custom_fields = [
        { id: 2, name: 'Modulo', value: module },
        { id: 3, name: 'Cliente', value: '' },
        { id: 4, name: 'Solicitante', value: requester },
        { id: 5, name: 'Revisão', value: '0' },
        ...extra
    ]
    return { tracker, custom_fields } as Issue
}

const category = (value: string) => ({ id: 6, name: 'Categoria', value })

const recent = [
    issue(development, 'Checkout', 'Marina', [category('Funcionalidade')]),
    issue(development, 'Checkout', 'Lucas', [category('Bug')]),
    issue(development, 'Catálogo', 'Marina', [category('')]),
    issue(bug, 'Pagamentos', 'Marina')
]

describe('projectCustomFields', () => {
    const fields = projectCustomFields(recent)

    it('fields filled in every recent issue of the tracker are required and come first', () => {
        const names = fields.byTracker[1].map((field) => [field.name, field.required])
        expect(names).toEqual([
            ['Modulo', true],
            ['Solicitante', true],
            ['Categoria', false]
        ])
    })
    it('suggests the values already used, most frequent first', () => {
        expect(fields.byTracker[1][0].suggestions).toEqual(['Checkout', 'Catálogo'])
    })
    it('leaves out checkboxes and fields nobody fills', () => {
        const ids = fields.all.map((field) => field.id)
        expect(ids).not.toContain(5)
        expect(ids).not.toContain(3)
    })
    it('with too few issues of a tracker, nothing is marked as required', () => {
        expect(fields.byTracker[2].every((field) => !field.required)).toBe(true)
    })
    it('a tracker without recent issues gets every field seen, none required', () => {
        const unknown = trackerCustomFields(fields, 7)
        expect(unknown.map((field) => field.name)).toEqual(['Modulo', 'Solicitante', 'Categoria'])
        expect(unknown.some((field) => field.required)).toBe(false)
        expect(trackerCustomFields(fields, undefined)).toEqual([])
    })
})

describe('customFieldEntries', () => {
    it("sends only the tracker's filled fields, trimmed", () => {
        const trackerFields = projectCustomFields(recent).byTracker[1]
        const values = { 2: ' Checkout ', 4: '', 99: 'other tracker' }
        expect(customFieldEntries(trackerFields, values)).toEqual([{ id: 2, value: 'Checkout' }])
    })
})

describe('inheritedCustomFields', () => {
    it('copies the single values that are filled', () => {
        const parent = [
            { id: 2, name: 'Modulo', value: 'Checkout' },
            { id: 3, name: 'Cliente', value: '' },
            { id: 9, name: 'Tags', value: ['a', 'b'] }
        ]
        expect(inheritedCustomFields(parent)).toEqual([{ id: 2, value: 'Checkout' }])
    })
})
