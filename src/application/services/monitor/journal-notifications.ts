import type { Board } from '@domain/board/board'
import { columnChange } from '@domain/board/board-rules'
import { isEventEnabled, type Monitor, type MonitorEvent } from '@domain/monitor/monitor'
import { interpretJournal, statusTransition } from '@domain/notification/journal-interpreter'
import type { IssueChange, NotificationKind, NotificationSource } from '@domain/notification/notification'
import type { Issue, Journal } from '@domain/redmine/entities'
import { issueRef, journalKey, type MonitorCycle } from './monitor-cycle'

const EVENT_OF_KIND: Partial<Record<NotificationKind, MonitorEvent>> = {
    mention: 'mention',
    assigned: 'assigned',
    status: 'status',
    comment: 'comment',
    updated: 'updated'
}

function enabledKind(kinds: NotificationKind[], monitor: Monitor): NotificationKind | undefined {
    return kinds.find((kind) => {
        const event = EVENT_OF_KIND[kind]
        return event !== undefined && isEventEnabled(monitor, event)
    })
}

/** On a board, a status change that moves the card is shown as the column change. */
function withColumnChange(changes: IssueChange[], journal: Journal, board?: Board): IssueChange[] {
    if (!board) return changes
    const transition = statusTransition(journal)
    if (!transition) return changes
    const moved = columnChange(board, transition.from, transition.to)
    if (!moved) return changes
    return changes.map((change) => {
        if (change.type !== 'statusChanged') return change
        return { type: 'columnChanged', from: moved.from, to: moved.to }
    })
}

/** Notifications for the new journals of one issue, filtered by the monitor's switched-on events. */
export async function notifyJournals(
    issue: Issue,
    monitor: Monitor,
    source: NotificationSource,
    cycle: MonitorCycle,
    board?: Board
): Promise<void> {
    const detail = await cycle.history(issue.id)
    if (!detail) return
    const statusName = (statusId: number) => cycle.statusName(statusId)

    for (const journal of cycle.journalsToNotify(detail)) {
        const interpreted = interpretJournal(journal, cycle.me, statusName)
        if (!interpreted) continue
        const kind = enabledKind(interpreted.kinds, monitor)
        if (!kind) continue

        const changes = withColumnChange(interpreted.changes, journal, board)
        const draft = {
            kind,
            payload: { type: 'issueChanged' as const, issue: issueRef(issue), actor: journal.user.name, changes },
            target: { type: 'url' as const, url: cycle.links.issue(issue.id) },
            issueId: issue.id,
            createdAt: journal.created_on
        }
        cycle.add(journalKey(journal.id), draft, source)
    }
}
