import { describe, expect, it } from 'vitest'
import { journalValue, namesById, peopleOfIssue, type JournalNames } from './journal-detail'

const names: JournalNames = {
    statuses: namesById([{ id: 2, name: 'Em andamento' }]),
    priorities: namesById([{ id: 4, name: 'Alta' }]),
    trackers: namesById([{ id: 1, name: 'Desenvolvimento' }]),
    versions: namesById([{ id: 378, name: '3.78' }]),
    people: namesById([{ id: 3, name: 'Lucas Pereira' }]),
    projects: namesById([{ id: 10, name: 'Loja Virtual' }])
}

describe('journalValue', () => {
    it('names the ids of each list', () => {
        expect(journalValue('status_id', '2', names)).toBe('Em andamento')
        expect(journalValue('priority_id', '4', names)).toBe('Alta')
        expect(journalValue('tracker_id', '1', names)).toBe('Desenvolvimento')
        expect(journalValue('fixed_version_id', '378', names)).toBe('3.78')
        expect(journalValue('assigned_to_id', '3', names)).toBe('Lucas Pereira')
        expect(journalValue('project_id', '10', names)).toBe('Loja Virtual')
    })

    it('shows #id when the name is not known, a dash when empty and other values as they are', () => {
        expect(journalValue('assigned_to_id', '99', names)).toBe('#99')
        expect(journalValue('category_id', '7', names)).toBe('#7')
        expect(journalValue('parent_id', '1201', names)).toBe('#1201')
        expect(journalValue('fixed_version_id', null, names)).toBe('—')
        expect(journalValue('subject', 'Novo título', names)).toBe('Novo título')
    })
})

describe('peopleOfIssue', () => {
    it('lists the author, assignee, watchers and who wrote in the history', () => {
        const issue = {
            author: { id: 1, name: 'Ana' },
            assigned_to: { id: 2, name: 'Bia' },
            watchers: [{ id: 3, name: 'Caio' }],
            journals: [{ id: 9, user: { id: 4, name: 'Davi' }, created_on: '', details: [] }]
        }
        expect(peopleOfIssue(issue).map((person) => person.name)).toEqual(['Ana', 'Bia', 'Caio', 'Davi'])
    })
})
