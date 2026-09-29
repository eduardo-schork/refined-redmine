import { describe, expect, it } from 'vitest'
import type { Journal } from '../redmine/entities'
import { interpretJournal } from './journal-interpreter'

const me = { id: 42, login: 'marina.costa' }
const names: Record<number, string> = { 2: 'Em andamento', 44: 'Em aprovação' }
const makeJournal = (details: Journal['details'], notes?: string): Journal => ({
    id: 1,
    user: { id: 8, name: 'Lucas' },
    created_on: '',
    details,
    notes
})

describe('interpretJournal', () => {
    it('status', () => {
        expect(
            interpretJournal(
                makeJournal([{ property: 'attr', name: 'status_id', old_value: '44', new_value: '2' }]),
                me,
                (id) => names[id]
            )
        ).toEqual({
            kind: 'status',
            kinds: ['status'],
            changes: [{ type: 'statusChanged', from: 'Em aprovação', to: 'Em andamento' }]
        })
    })
    it('assignment to me takes priority over status', () => {
        const result = interpretJournal(
            makeJournal([
                { property: 'attr', name: 'status_id', old_value: '1', new_value: '2' },
                { property: 'attr', name: 'assigned_to_id', old_value: '8', new_value: '42' }
            ]),
            me,
            (id) => names[id]
        )
        expect(result?.kind).toBe('assigned')
        expect(result?.kinds).toEqual(['assigned', 'status'])
    })
    it('mention has the highest priority', () => {
        const result = interpretJournal(
            makeJournal(
                [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '2' }],
                'pode ver @marina.costa?'
            ),
            me,
            () => undefined
        )
        expect(result?.kind).toBe('mention')
        expect(result?.changes.at(-1)).toEqual({ type: 'mentioned', excerpt: 'pode ver @marina.costa?' })
    })
    it('comment and other changes', () => {
        expect(interpretJournal(makeJournal([], 'ok'), me, () => undefined)?.kind).toBe('comment')
        expect(
            interpretJournal(
                makeJournal([{ property: 'attr', name: 'due_date', new_value: '2026-10-01' }]),
                me,
                () => undefined
            )?.kind
        ).toBe('updated')
        expect(interpretJournal(makeJournal([]), me, () => undefined)).toBeNull()
    })
})
