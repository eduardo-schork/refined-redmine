import { describe, expect, it } from 'vitest'
import { statusTone } from './status-tone'

const open = (name: string) => ({ id: 1, name, is_closed: false })
const closed = (name: string) => ({ id: 2, name, is_closed: true })

describe('statusTone', () => {
    it('infers the family from the status name', () => {
        expect(statusTone(open('Nova'))).toBe('new')
        expect(statusTone(open('Em andamento'))).toBe('progress')
        expect(statusTone(open('Em aprovação'))).toBe('review')
        expect(statusTone(open('Em teste'))).toBe('testing')
        expect(statusTone(open('Em pausa'))).toBe('blocked')
        expect(statusTone(open('Resolvida'))).toBe('done')
        expect(statusTone(open('In Progress'))).toBe('progress')
    })

    it('lets the user choose the color of a status', () => {
        const rules = { statusTones: { 1: 'review' as const }, priorityLevels: {}, dueSoonDays: 3 }
        expect(statusTone(open('Aguardando deploy'), rules)).toBe('review')
        expect(statusTone({ id: 3, name: 'Aguardando deploy', is_closed: false }, rules)).toBe('blocked')
    })

    it('uses the closed flag first', () => {
        expect(statusTone(closed('Finalizada'))).toBe('done')
        expect(statusTone(closed('Fechada'))).toBe('done')
        expect(statusTone(closed('Rejeitada'))).toBe('rejected')
    })
})
