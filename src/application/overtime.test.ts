import { describe, expect, it } from 'vitest'
import { EMPTY_BANK, type OvertimeBank } from '@domain/time/overtime'
import type { OvertimeRepository } from './ports/repositories'
import { SeqIds } from './testing/fakes'
import { OvertimeUseCases } from './use-cases/overtime'

function setup() {
    let stored: OvertimeBank = EMPTY_BANK
    const repo: OvertimeRepository = {
        load: () => stored,
        save: (bank) => (stored = bank)
    }
    return new OvertimeUseCases(repo, new SeqIds())
}

describe('OvertimeUseCases', () => {
    it('adds validated entries, removes them and marks months as paid', () => {
        const overtime = setup()
        const added = overtime.add({ day: '2026-10-21', hours: 1.5, issueId: 1201, note: '  deploy  ' })
        expect(added.entries).toEqual([
            { id: expect.any(String), day: '2026-10-21', hours: 1.5, issueId: 1201, note: 'deploy' }
        ])
        expect(() => overtime.add({ day: '2026-10-21', hours: 30, note: '' })).toThrow('overtime.hours')
        expect(overtime.setPaid('2026-10', true).paidMonths).toEqual(['2026-10'])
        expect(() => overtime.setPaid('2026-13', true)).toThrow('overtime.month')
        expect(overtime.remove(added.entries[0].id).entries).toEqual([])
    })
})
