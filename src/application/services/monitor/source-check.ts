import type { Board } from '@domain/board/board'
import type { LogLevel, LogRecord } from '@domain/log/log-entry'
import { countRuleReached, isEventEnabled, type Monitor, type MonitorSource } from '@domain/monitor/monitor'
import {
    diffMembership,
    isComplete,
    snapshotOf,
    type MembershipChange,
    type QuerySnapshot
} from '@domain/monitor/query-diff'
import {
    boardRoute,
    type IssueRef,
    type NotificationSource,
    type NotificationTarget
} from '@domain/notification/notification'
import type { Issue, Page } from '@domain/redmine/entities'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import { issuesPageUrl, parseIssuesUrl } from '@domain/redmine/issues-url'
import type { RedmineGateway } from '../../ports/redmine-gateway'
import type { MonitorStateRepository } from '../../ports/repositories'
import type { BoardFilterResolver } from '../../use-cases/boards'
import { notifyJournals } from './journal-notifications'
import { countKey, issueRef, membershipKey, type MonitorCycle } from './monitor-cycle'

/** Largest result compared between cycles; beyond it only the count is compared. */
export const MAX_MONITOR_ISSUES = 500
const MAX_CHANGED_BY_ME_CHECKS = 15
const MAX_CHANGED_ISSUES = 100

type ExternalSource = Exclude<MonitorSource, { type: 'mine' }>

export interface SourceCheckDeps {
    gateway: RedmineGateway
    state: MonitorStateRepository
    boards: () => Board[]
    boardFilter: BoardFilterResolver
    log: (record: LogRecord, level?: LogLevel) => void
}

interface ResolvedSource {
    filter: IssueFilter
    /** Where a click on a notification about several issues leads. */
    listTarget: NotificationTarget
    board?: Board
}

type SkipReason = 'boardMissing' | 'sprintUnresolved'

async function resolveSource(
    source: ExternalSource,
    cycle: MonitorCycle,
    deps: SourceCheckDeps
): Promise<ResolvedSource | SkipReason> {
    switch (source.type) {
        case 'query': {
            const filter = { queryId: source.queryId, queryProjectId: source.projectId }
            const url = cycle.links.query(source.queryId, source.projectId)
            return { filter, listTarget: { type: 'url', url } }
        }
        case 'filter': {
            const parsed = parseIssuesUrl(source.url)
            const url = issuesPageUrl(cycle.links.base, parsed)
            return { filter: { rawQuery: parsed.query }, listTarget: { type: 'url', url } }
        }
        case 'board': {
            const board = deps.boards().find((candidate) => candidate.id === source.boardId)
            if (!board) return 'boardMissing'
            const resolved = await deps.boardFilter.resolve(board)
            if (!resolved.filter) return 'sprintUnresolved'
            return { filter: resolved.filter, listTarget: { type: 'route', route: boardRoute(board.id) }, board }
        }
    }
}

/**
 * Query, copied filter or board: compares the result with the previous cycle (entered/left)
 * and reads the history of the issues changed since then.
 */
export async function checkSource(
    monitor: Monitor,
    source: ExternalSource,
    cycle: MonitorCycle,
    deps: SourceCheckDeps
): Promise<void> {
    const resolved = await resolveSource(source, cycle, deps)
    if (typeof resolved === 'string') {
        deps.log(
            { type: 'monitor', event: 'monitorSkipped', params: { monitor: monitor.id, reason: resolved } },
            'warn'
        )
        return
    }

    const notificationSource: NotificationSource = { monitorId: monitor.id, name: resolved.board?.name ?? monitor.name }
    const previous = deps.state.getSnapshot(monitor.id)
    const page = await listSource(resolved.filter, cycle.sinceOf(monitor.id), previous, deps.gateway)
    const current = snapshotOf(page.total, page.items)
    deps.state.setSnapshot(monitor.id, current)
    if (!isComplete(current)) {
        const params = { monitor: monitor.id, total: current.count, compared: current.ids.length }
        deps.log({ type: 'monitor', event: 'monitorPartial', params }, 'warn')
    }

    const change = diffMembership(previous, current)
    if (change && previous) {
        await notifyMembership(change, previous, page.items, monitor, notificationSource, resolved, cycle)
        if (!isEventEnabled(monitor, 'left')) {
            await notifyDepartedChanges(change.left, monitor, notificationSource, cycle, resolved.board)
        }
    }
    if (monitor.count && countRuleReached(previous?.count, current.count, monitor.count)) {
        const payload = {
            type: 'queryCount' as const,
            queryName: notificationSource.name,
            count: current.count,
            ...monitor.count
        }
        cycle.add(countKey(monitor.id), { kind: 'query', payload, target: resolved.listTarget }, notificationSource)
    }

    const changedIssues = page.items.filter((issue) => cycle.isNew(issue, monitor.id))
    for (const issue of changedIssues) {
        cycle.sawUpdate(monitor.id, issue)
        await notifyJournals(issue, monitor, notificationSource, cycle, resolved.board)
    }

    const params = { monitor: monitor.id, total: current.count, changed: changedIssues.length }
    deps.log({ type: 'monitor', event: 'monitorChecked', params })
}

/**
 * An issue that left the result because someone changed it (usually its status) is no longer listed. Without
 * "left", the change is still reported by the switched-on events, read from the issue's history.
 */
async function notifyDepartedChanges(
    issueIds: number[],
    monitor: Monitor,
    source: NotificationSource,
    cycle: MonitorCycle,
    board?: Board
): Promise<void> {
    for (const issueId of issueIds) {
        const departed = await cycle.history(issueId)
        if (!departed || !cycle.isNew(departed, monitor.id)) continue
        cycle.sawUpdate(monitor.id, departed)
        await notifyJournals(departed, monitor, source, cycle, board)
    }
}

// Saved queries and copied URLs bring their own filters: Redmine ignores an extra date filter on them.
const acceptsUpdatedSince = (filter: IssueFilter) => filter.queryId === undefined && filter.rawQuery === undefined

/**
 * A result bigger than MAX_MONITOR_ISSUES can only be compared by its count. When the previous cycle was like that
 * and the filter takes a date (a board of "mine", a project or a sprint), the count and the issues changed since the
 * watermark are enough: two small requests instead of paging through 500 issues every cycle.
 */
async function listSource(
    filter: IssueFilter,
    since: string,
    previous: QuerySnapshot | undefined,
    gateway: RedmineGateway
): Promise<Page<Issue>> {
    const wasTooBig = previous !== undefined && !isComplete(previous)
    if (!wasTooBig || !acceptsUpdatedSince(filter)) return gateway.listIssues(filter, MAX_MONITOR_ISSUES)

    const total = await gateway.countIssues(filter)
    if (total <= MAX_MONITOR_ISSUES) return gateway.listIssues(filter, MAX_MONITOR_ISSUES)
    const changedFilter: IssueFilter = { ...filter, updatedSince: since, sort: 'updatedDesc' }
    const changed = await gateway.listIssues(changedFilter, MAX_CHANGED_ISSUES)
    return { items: changed.items, total }
}

/** Own actions do not notify: an issue the user moved in or out themselves is dropped. */
async function withoutMyChanges(issueIds: number[], monitorId: string, cycle: MonitorCycle): Promise<number[]> {
    const kept: number[] = []
    for (const issueId of issueIds.slice(0, MAX_CHANGED_BY_ME_CHECKS)) {
        const byMe = await cycle.changedByMe(issueId, monitorId)
        if (!byMe) kept.push(issueId)
    }
    return [...kept, ...issueIds.slice(MAX_CHANGED_BY_ME_CHECKS)]
}

function refsOf(issueIds: number[], issues: Issue[], snapshot: QuerySnapshot): IssueRef[] {
    const issuesById = new Map(issues.map((issue) => [issue.id, issue]))
    return issueIds.map((id) => {
        const issue = issuesById.get(id)
        if (issue) return issueRef(issue)
        return { id, subject: snapshot.subjects?.[id] ?? '' }
    })
}

/**
 * Entries and exits, as switched on in the monitor. With a partial result (too many issues)
 * the ids cannot be compared, so the notification only tells the new count.
 */
async function notifyMembership(
    change: MembershipChange,
    previous: QuerySnapshot,
    issues: Issue[],
    monitor: Monitor,
    source: NotificationSource,
    resolved: ResolvedSource,
    cycle: MonitorCycle
): Promise<void> {
    const wantsEntered = isEventEnabled(monitor, 'entered')
    const wantsLeft = isEventEnabled(monitor, 'left')
    const onlyCountKnown = change.entered.length === 0 && change.left.length === 0
    if (onlyCountKnown && !isWantedCountChange(change, wantsEntered, wantsLeft)) return

    const enteredIds = wantsEntered ? await withoutMyChanges(change.entered, monitor.id, cycle) : []
    const leftIds = wantsLeft ? await withoutMyChanges(change.left, monitor.id, cycle) : []
    const nothingToTell = !onlyCountKnown && enteredIds.length === 0 && leftIds.length === 0
    if (nothingToTell) return

    const added = refsOf(enteredIds, issues, previous)
    const removed = refsOf(leftIds, issues, previous)
    const mentionedIssues = [...added, ...removed]
    const singleIssue = mentionedIssues.length === 1 ? mentionedIssues[0] : undefined
    const target = membershipTarget(singleIssue, resolved, cycle)
    const payload = {
        type: 'queryChanged' as const,
        queryName: source.name,
        from: change.from,
        to: change.to,
        added,
        removed
    }
    cycle.add(membershipKey(monitor.id), { kind: 'query', payload, target, issueId: singleIssue?.id }, source)
}

function isWantedCountChange(change: MembershipChange, wantsEntered: boolean, wantsLeft: boolean): boolean {
    const grew = change.to > change.from
    if (grew) return wantsEntered
    return wantsLeft
}

/** One issue: open it; several: open the list (query page or board). */
function membershipTarget(
    singleIssue: IssueRef | undefined,
    resolved: ResolvedSource,
    cycle: MonitorCycle
): NotificationTarget {
    if (!singleIssue) return resolved.listTarget
    return { type: 'url', url: cycle.links.issue(singleIssue.id) }
}
