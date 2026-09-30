import { describe, expect, it } from 'vitest'
import { foldForSearch } from './text'

describe('foldForSearch', () => {
    it('ignores case and accents', () => {
        expect(foldForSearch('Configurações')).toBe('configuracoes')
        expect(foldForSearch('NOTIFICAÇÕES')).toContain(foldForSearch('notificacoes'))
    })
})
