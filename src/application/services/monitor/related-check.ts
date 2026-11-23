import { neighbourIds } from '@domain/automation/handoff'
import type { Monitor, RelatedStatusRule } from '@domain/monitor/monitor'
import {
    issuesLinkedTo,
    linkedRelatedIds,
    linksToRefresh,
    pruneWatch,
    relatedMarks,
    relatedStatusChanges,
    watchFor,
    withLinks,
    withRelatedSeen,
    type RelatedMark,
    type RelatedStatusChange,
    type RelatedWatch
} from '@domain/monitor/related-status'
import { statusTransition } from '@domain/notification/journal-interpreter'
import type { IssueChange, NotificationSource } from '@domain/notification/notification'
import type { Issue } from '@domain/redmine/entities'
import type { RedmineGateway } from '../../ports/redmine-gateway'
import type { MonitorStateRepository } from '../../ports/repositories'
import { issuesByIds } from '../../use-cases/issue-lookup'
import { issueRef, relatedKey, type MonitorCycle } from './monitor-cycle'

/** Requests spent looking for links, per monitor and cycle; the issues left wait for the next cycle. */
export const MAX_LINK_REQUESTS_PER_CYCLE = 40
/** Dev → Business → Quality is two links away; one more covers a subtask in between. */
const MAX_LINK_DEPTH = 3

export interface RelatedCheckDeps {
    gateway: RedmineGateway
    state: MonitorStateRepository
}

interface Budget {
    left: number
}

function spend(budget: Budget): boolean {
    if (budget.left <= 0) return false
    budget.left--
    return true
}

/** Issues by id in one listing, keeping only the ones asked for. */
async function readIssues(gateway: RedmineGateway, ids: number[]): Promise<Issue[]> {
    if (!ids.length) return []
    const wanted = new Set(ids)
    const issues = await issuesByIds(gateway, ids)
    return issues.filter((issue) => wanted.has(issue.id))
}

async function neighboursOf(
    gateway: RedmineGateway,
    issueIds: number[],
    budget: Budget
): Promise<number[] | undefined> {
    const neighbours: number[] = []
    for (const issueId of issueIds) {
        if (!spend(budget)) return undefined
        const detail = await gateway.getIssueLinks(issueId).catch(() => undefined)
        if (detail) neighbours.push(...neighbourIds(detail))
    }
    return neighbours
}

/**
 * Issues of the tracker linked to `issueId` (parent, subtasks and relations), level by level, stopping at the first
 * level where one is found. Undefined when the budget ran out: the issue is looked at again in the next cycle.
 */
export async function findRelatedOfTracker(
    gateway: RedmineGateway,
    issueId: number,
    trackerId: number,
    budget: Budget
): Promise<number[] | undefined> {
    const visited = new Set([issueId])
    let frontier = [issueId]
    for (let depth = 1; depth <= MAX_LINK_DEPTH && frontier.length; depth++) {
        const neighbours = await neighboursOf(gateway, frontier, budget)
        if (!neighbours) return undefined
        const unseen = [...new Set(neighbours)].filter((id) => !visited.has(id))
        for (const id of unseen) visited.add(id)
        if (!unseen.length) return []
        if (!spend(budget)) return undefined
        const issues = await readIssues(gateway, unseen)
        const found = issues.filter((issue) => issue.tracker.id === trackerId).map((issue) => issue.id)
        if (found.length) return found
        frontier = issues.map((issue) => issue.id)
    }
    return []
}

async function refreshLinks(
    watch: RelatedWatch,
    sourceIds: number[],
    items: Issue[],
    rule: RelatedStatusRule,
    gateway: RedmineGateway,
    now: Date
): Promise<RelatedWatch> {
    const updatedOn = new Map(items.map((issue) => [issue.id, issue.updated_on]))
    const sourceIssues = sourceIds.map((id) => ({ id, updatedOn: updatedOn.get(id) }))
    const budget = { left: MAX_LINK_REQUESTS_PER_CYCLE }
    let refreshed = watch
    for (const issueId of linksToRefresh(watch, sourceIssues, now)) {
        const relatedIds = await findRelatedOfTracker(gateway, issueId, rule.trackerId, budget)
        if (!relatedIds) break
        const links = { relatedIds, checkedAt: now.toISOString(), issueUpdatedOn: updatedOn.get(issueId) }
        refreshed = withLinks(refreshed, issueId, links)
    }
    return refreshed
}

interface ChangeContext {
    watch: RelatedWatch
    related: Map<number, Issue>
    items: Map<number, Issue>
    source: NotificationSource
    cycle: MonitorCycle
    gateway: RedmineGateway
}

function relatedChangeOf(change: RelatedStatusChange, relatedIssue: Issue, cycle: MonitorCycle): IssueChange {
    return {
        type: 'relatedStatusChanged',
        relatedId: change.relatedId,
        relatedSubject: relatedIssue.subject,
        tracker: relatedIssue.tracker.name,
        from: cycle.statusName(change.fromStatusId) ?? String(change.fromStatusId),
        to: cycle.statusName(change.toStatusId) ?? relatedIssue.status.name
    }
}

/** Issues of the source linked to the related issue; the ones not in this cycle's listing are read. */
async function linkedIssues(relatedId: number, context: ChangeContext): Promise<Issue[]> {
    const linkedIds = issuesLinkedTo(context.watch, relatedId)
    const listed = linkedIds.flatMap((issueId) => context.items.get(issueId) ?? [])
    const missing = linkedIds.filter((issueId) => !context.items.has(issueId))
    return [...listed, ...(await readIssues(context.gateway, missing))]
}

/** The journal that set the current status tells who changed it; the user's own changes are not news. */
async function notifyChange(change: RelatedStatusChange, context: ChangeContext): Promise<void> {
    const { cycle } = context
    const relatedIssue = context.related.get(change.relatedId)
    if (!relatedIssue) return
    const history = await cycle.history(change.relatedId)
    const journal = history?.journals.findLast((candidate) => statusTransition(candidate)?.to === change.toStatusId)
    if (journal?.user.id === cycle.me.id) return

    const changes = [relatedChangeOf(change, relatedIssue, cycle)]
    const actor = journal?.user.name ?? ''
    const changeMarker = journal ? String(journal.id) : relatedIssue.updated_on
    const createdAt = journal?.created_on ?? relatedIssue.updated_on
    for (const issue of await linkedIssues(change.relatedId, context)) {
        const draft = {
            kind: 'status' as const,
            payload: { type: 'issueChanged' as const, issue: issueRef(issue), actor, changes },
            target: { type: 'url' as const, url: cycle.links.issue(issue.id) },
            issueId: issue.id,
            createdAt
        }
        cycle.add(relatedKey(change.relatedId, changeMarker, issue.id), draft, context.source)
    }
}

/**
 * The monitor's related-status rule: finds (and keeps) the related issues of each issue of the source, reads their
 * statuses in one listing and notifies, on each linked issue, the ones that went to a status of the rule.
 */
export async function checkRelated(
    monitorId: string,
    rule: RelatedStatusRule,
    sourceIds: number[],
    items: Issue[],
    source: NotificationSource,
    cycle: MonitorCycle,
    deps: RelatedCheckDeps
): Promise<void> {
    const stored = pruneWatch(watchFor(deps.state.getRelatedWatch(monitorId), rule), sourceIds)
    const watch = await refreshLinks(stored, sourceIds, items, rule, deps.gateway, cycle.now())
    const relatedIssues = await readIssues(deps.gateway, linkedRelatedIds(watch))
    const current = relatedIssues.map((issue) => ({ id: issue.id, statusId: issue.status.id, subject: issue.subject }))
    const context: ChangeContext = {
        watch,
        related: new Map(relatedIssues.map((issue) => [issue.id, issue])),
        items: new Map(items.map((issue) => [issue.id, issue])),
        source,
        cycle,
        gateway: deps.gateway
    }
    for (const change of relatedStatusChanges(watch, current, rule)) await notifyChange(change, context)
    deps.state.setRelatedWatch(monitorId, withRelatedSeen(watch, current))
}

/** The cards' marks, from what the enabled monitors with a related-status rule last saw (no request). */
export function relatedMarksOf(monitors: Monitor[], state: MonitorStateRepository): RelatedMark[] {
    const marks = monitors.flatMap((monitor) => {
        if (!monitor.enabled || !monitor.related) return []
        const watch = watchFor(state.getRelatedWatch(monitor.id), monitor.related)
        return relatedMarks(watch, monitor.related)
    })
    // Two monitors may follow the same pair of issues.
    const unique = new Map(marks.map((mark) => [`${mark.issueId}:${mark.relatedId}`, mark]))
    return [...unique.values()]
}
