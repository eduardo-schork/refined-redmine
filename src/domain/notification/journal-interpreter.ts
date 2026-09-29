import { escapeRegex, snippet } from '../shared/text'
import type { Journal, JournalDetail } from '../redmine/entities'
import type { IssueChange, NotificationKind } from './notification'

const KIND_PRIORITY: NotificationKind[] = ['mention', 'assigned', 'status', 'comment', 'updated']

export interface InterpretedJournal {
    /** The most important kind. */
    kind: NotificationKind
    /** Every kind present, most important first (a monitor may have the first one switched off). */
    kinds: NotificationKind[]
    changes: IssueChange[]
}

interface InterpretedChange {
    kind: NotificationKind
    change: IssueChange
}

type StatusNameLookup = (id: number) => string | undefined

function interpretAttributeChange(
    detail: JournalDetail,
    meId: number,
    statusName: StatusNameLookup
): InterpretedChange {
    switch (detail.name) {
        case 'assigned_to_id': {
            const assignedToMe = Number(detail.new_value) === meId
            if (assignedToMe) return { kind: 'assigned', change: { type: 'assignedToYou' } }
            return { kind: 'updated', change: { type: 'assigneeChanged' } }
        }
        case 'status_id': {
            const from = statusName(Number(detail.old_value)) ?? String(detail.old_value)
            const to = statusName(Number(detail.new_value)) ?? String(detail.new_value)
            return { kind: 'status', change: { type: 'statusChanged', from, to } }
        }
        default:
            return { kind: 'updated', change: { type: 'fieldChanged', field: detail.name } }
    }
}

function interpretNotes(notes: string, login: string): InterpretedChange {
    const mentionPattern = new RegExp(`@${escapeRegex(login)}\\b`, 'i')
    const excerpt = snippet(notes)
    if (mentionPattern.test(notes)) return { kind: 'mention', change: { type: 'mentioned', excerpt } }
    return { kind: 'comment', change: { type: 'commented', excerpt } }
}

/**
 * Turns a Redmine journal into readable changes and picks
 * the most important kind (mention > assignment > status > comment > others).
 */
export function interpretJournal(
    journal: Journal,
    me: { id: number; login: string },
    statusName: StatusNameLookup
): InterpretedJournal | null {
    const attributeDetails = journal.details.filter((detail) => detail.property === 'attr')
    const interpreted = attributeDetails.map((detail) => interpretAttributeChange(detail, me.id, statusName))

    const hasAttachment = journal.details.some((detail) => detail.property === 'attachment')
    if (hasAttachment) interpreted.push({ kind: 'updated', change: { type: 'attachmentAdded' } })

    const notes = journal.notes?.trim()
    if (notes) interpreted.push(interpretNotes(notes, me.login))

    const presentKinds = new Set(interpreted.map((item) => item.kind))
    const kinds = KIND_PRIORITY.filter((candidate) => presentKinds.has(candidate))
    if (!kinds.length) return null
    return { kind: kinds[0], kinds, changes: interpreted.map((item) => item.change) }
}

/** Status ids changed by the journal, if it changed the status. */
export function statusTransition(journal: Journal): { from: number; to: number } | null {
    const detail = journal.details.find((candidate) => candidate.property === 'attr' && candidate.name === 'status_id')
    if (!detail) return null
    return { from: Number(detail.old_value), to: Number(detail.new_value) }
}
