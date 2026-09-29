import type { IssueDetail, IssueStatus, Journal, JournalDetail } from '../redmine/entities'
import { snippet } from '../shared/text'
import type { QueueExitReason } from '../notification/notification'

export interface QueueExit {
    /** Journal that removed the issue from the queue (the monitor does not generate another event for it). */
    causeJournalId?: number
    actor?: string
    reasons: QueueExitReason[]
    excerpt?: string
    /** The person removed it from the queue themselves: no notification. */
    byMe: boolean
}

type StatusMap = ReadonlyMap<number, IssueStatus>

function isClosedStatus(statuses: StatusMap, statusId: number): boolean {
    return Boolean(statuses.get(statusId)?.is_closed)
}

function isClosingDetail(detail: JournalDetail, statuses: StatusMap): boolean {
    return detail.name === 'status_id' && isClosedStatus(statuses, Number(detail.new_value))
}

function removedFromQueue(detail: JournalDetail, meId: number, statuses: StatusMap): boolean {
    if (detail.property !== 'attr') return false
    const unassignedMe = detail.name === 'assigned_to_id' && Number(detail.old_value) === meId
    return unassignedMe || isClosingDetail(detail, statuses)
}

function findCauseJournal(issue: IssueDetail, meId: number, statuses: StatusMap): Journal | undefined {
    const newestFirst = [...issue.journals].reverse()
    return newestFirst.find((journal) => journal.details.some((detail) => removedFromQueue(detail, meId, statuses)))
}

/** Without an explaining journal, describes where the issue is now. */
function currentSituation(issue: IssueDetail, meId: number): QueueExitReason {
    if (issue.assigned_to?.id !== meId) return { type: 'nowWith', name: issue.assigned_to?.name }
    return { type: 'status', status: issue.status.name }
}

function exitReasons(
    issue: IssueDetail,
    cause: Journal | undefined,
    meId: number,
    statuses: StatusMap
): QueueExitReason[] {
    const reasons: QueueExitReason[] = []
    const reassigned = cause?.details.find((detail) => detail.name === 'assigned_to_id')
    if (reassigned) reasons.push({ type: 'reassigned', to: issue.assigned_to?.name })

    const closed = cause?.details.find((detail) => isClosingDetail(detail, statuses))
    if (closed) {
        const closedStatusName = statuses.get(Number(closed.new_value))?.name ?? issue.status.name
        reasons.push({ type: 'closed', status: closedStatusName })
    }

    if (reasons.length > 0) return reasons
    return [currentSituation(issue, meId)]
}

/**
 * Explains why an issue left the queue of `meId`.
 * Searches, from newest to oldest, for the journal that removed the assignment or moved it to a closed status.
 */
export function explainQueueExit(issue: IssueDetail, meId: number, statuses: StatusMap): QueueExit {
    const cause = findCauseJournal(issue, meId, statuses)
    const notes = cause?.notes?.trim()
    return {
        causeJournalId: cause?.id,
        actor: cause?.user.name,
        reasons: exitReasons(issue, cause, meId, statuses),
        excerpt: notes ? snippet(notes, 80) : undefined,
        byMe: cause?.user.id === meId
    }
}

/** IDs that were in the queue and no longer are. */
export function departedIds(previous: number[], current: number[], limit: number): number[] {
    const currentIds = new Set(current)
    const departed = previous.filter((id) => !currentIds.has(id))
    return departed.slice(0, limit)
}
