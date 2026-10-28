import { isEventEnabled, type MineScopes, type Monitor } from '@domain/monitor/monitor'
import { departedIds, explainQueueExit } from '@domain/monitor/queue-exit'
import { snapshotOf } from '@domain/monitor/query-diff'
import type { NotificationPayload, NotificationSource } from '@domain/notification/notification'
import type { Issue } from '@domain/redmine/entities'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import type { RedmineGateway } from '../../ports/redmine-gateway'
import type { MonitorStateRepository } from '../../ports/repositories'
import { notifyJournals } from './journal-notifications'
import { createdKey, issueRef, queueExitKey, type MonitorCycle } from './monitor-cycle'

export const QUEUE_SNAPSHOT = '__my_queue__'
const MAX_QUEUE = 500
const MAX_QUEUE_EXITS_PER_CYCLE = 15
const MAX_CHANGED_ISSUES_PER_SCOPE = 100

export interface MineCheckDeps {
    gateway: RedmineGateway
    state: MonitorStateRepository
}

function scopeFilters(scopes: MineScopes): IssueFilter[] {
    const filters: IssueFilter[] = []
    if (scopes.assigned) filters.push({ assignedTo: 'me' })
    if (scopes.watched) filters.push({ watcher: 'me' })
    if (scopes.authored) filters.push({ author: 'me' })
    return filters
}

/**
 * "My issues": issues assigned to me, watched or created by me.
 * 1. Queue exits first, so the journal that removed the issue is not reported twice.
 * 2. Issues changed since the last cycle, read through their history.
 */
export async function checkMine(
    monitor: Monitor,
    scopes: MineScopes,
    cycle: MonitorCycle,
    deps: MineCheckDeps
): Promise<void> {
    const source: NotificationSource = { monitorId: monitor.id, name: monitor.name, sourceType: 'mine' }
    await checkQueueExits(monitor, source, cycle, deps)
    const since = cycle.sinceOf(monitor.id)
    const issues = await fetchChangedIssues(scopeFilters(scopes), since, deps.gateway)
    for (const issue of issues) {
        cycle.sawUpdate(monitor.id, issue)
        await notifyIssue(issue, monitor, source, cycle)
    }
}

async function checkQueueExits(
    monitor: Monitor,
    source: NotificationSource,
    cycle: MonitorCycle,
    deps: MineCheckDeps
): Promise<void> {
    if (!isEventEnabled(monitor, 'left')) {
        // Switching it back on must not report everything that left in the meantime.
        deps.state.deleteSnapshot(QUEUE_SNAPSHOT)
        return
    }
    const queue = await deps.gateway.listIssues({ assignedTo: 'me', status: 'open' }, MAX_QUEUE)
    const previous = deps.state.getSnapshot(QUEUE_SNAPSHOT)
    const current = snapshotOf(queue.total, queue.items)
    deps.state.setSnapshot(QUEUE_SNAPSHOT, { count: current.count, ids: current.ids })
    if (!previous) return

    const departed = departedIds(previous.ids, current.ids, MAX_QUEUE_EXITS_PER_CYCLE)
    for (const issueId of departed) await notifyQueueExit(issueId, source, cycle)
}

async function notifyQueueExit(issueId: number, source: NotificationSource, cycle: MonitorCycle): Promise<void> {
    const target = { type: 'url' as const, url: cycle.links.issue(issueId) }
    const issue = await cycle.history(issueId, false)
    if (!issue) {
        const payload: NotificationPayload = { type: 'queueExitHidden', issueId }
        cycle.add(queueExitKey(issueId), { kind: 'unqueued', payload, target, issueId }, source)
        return
    }

    const exit = explainQueueExit(issue, cycle.me.id, cycle.statuses)
    if (exit.byMe) return
    if (exit.causeJournalId) cycle.markJournalReported(exit.causeJournalId)

    const cause = issue.journals.find((journal) => journal.id === exit.causeJournalId)
    const payload: NotificationPayload = {
        type: 'queueExit',
        issue: issueRef(issue),
        actor: exit.actor,
        reasons: exit.reasons,
        excerpt: exit.excerpt
    }
    const createdAt = cause?.created_on ?? issue.updated_on
    cycle.add(queueExitKey(issueId), { kind: 'unqueued', payload, target, issueId, createdAt }, source)
}

/** Issues from all scopes, deduplicated, most recently updated first. */
async function fetchChangedIssues(filters: IssueFilter[], since: string, gateway: RedmineGateway): Promise<Issue[]> {
    const changed = new Map<number, Issue>()
    for (const scope of filters) {
        const filter: IssueFilter = { ...scope, status: '*', updatedSince: since, sort: 'updatedDesc' }
        const page = await gateway.listIssues(filter, MAX_CHANGED_ISSUES_PER_SCOPE)
        for (const issue of page.items) changed.set(issue.id, issue)
    }
    return [...changed.values()].sort((first, second) => second.updated_on.localeCompare(first.updated_on))
}

async function notifyIssue(
    issue: Issue,
    monitor: Monitor,
    source: NotificationSource,
    cycle: MonitorCycle
): Promise<void> {
    if (!cycle.isNew(issue, monitor.id)) return

    const createdSince = issue.created_on > cycle.sinceOf(monitor.id)
    const createdBySomeoneElse = createdSince && issue.author.id !== cycle.me.id
    if (createdBySomeoneElse) {
        if (!isEventEnabled(monitor, 'new_issue')) return
        const payload: NotificationPayload = {
            type: 'issueCreated',
            issue: issueRef(issue),
            actor: issue.author.name,
            assignedToYou: issue.assigned_to?.id === cycle.me.id
        }
        const target = { type: 'url' as const, url: cycle.links.issue(issue.id) }
        const draft = { kind: 'new_issue' as const, payload, target, issueId: issue.id, createdAt: issue.updated_on }
        cycle.add(createdKey(issue.id), draft, source)
        return
    }
    await notifyJournals(issue, monitor, source, cycle)
}
