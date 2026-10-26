import { AppError } from '@domain/shared/errors'
import {
    assertValidMonth,
    assertValidOvertime,
    setMonthPaid,
    type OvertimeBank,
    type OvertimeDraft
} from '@domain/time/overtime'
import type { OvertimeRepository } from '../ports/repositories'
import type { IdGenerator } from '../ports/system'

export class OvertimeUseCases {
    constructor(
        private readonly repo: OvertimeRepository,
        private readonly ids: IdGenerator
    ) {}

    list(): OvertimeBank {
        return this.repo.load()
    }

    add(draft: OvertimeDraft): OvertimeBank {
        const cleaned = { ...draft, note: draft.note.trim() }
        assertValidOvertime(cleaned)
        const bank = this.repo.load()
        return this.repo.save({ ...bank, entries: [...bank.entries, { ...cleaned, id: this.ids.next() }] })
    }

    /** Changes an entry (day, hours, issue, note) with the same checks as adding one; it keeps its id. */
    update(id: string, draft: OvertimeDraft): OvertimeBank {
        const cleaned = { ...draft, note: draft.note.trim() }
        assertValidOvertime(cleaned)
        const bank = this.repo.load()
        if (!bank.entries.some((entry) => entry.id === id)) throw new AppError('overtime.notFound')
        const entries = bank.entries.map((entry) => (entry.id === id ? { ...cleaned, id } : entry))
        return this.repo.save({ ...bank, entries })
    }

    remove(id: string): OvertimeBank {
        const bank = this.repo.load()
        return this.repo.save({ ...bank, entries: bank.entries.filter((entry) => entry.id !== id) })
    }

    /** A month is either kept in the bank or paid out. */
    setPaid(month: string, paid: boolean): OvertimeBank {
        assertValidMonth(month)
        return this.repo.save(setMonthPaid(this.repo.load(), month, paid))
    }
}
