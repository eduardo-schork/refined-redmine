import type { Issue } from '@domain/redmine/entities'
import {
    bulkDiff,
    buildIssueTree,
    isEmptyChange,
    treeRoots,
    TREE_SUBTASK_LEVELS,
    unappliedFields,
    type BulkChange,
    type BulkEditResult,
    type IssueTreeNode
} from '@domain/redmine/issue-tree'
import type { RedmineGateway } from '../ports/redmine-gateway'
import { issuesByIds } from './issue-lookup'

/** Subtasks listed per request (a page of the issue list). */
const MAX_SUBTASKS_PER_LEVEL = 500

/** Subtasks of the given issues, level by level: one listing per level, issues the user cannot see left out. */
async function subtasksOf(gateway: RedmineGateway, rootIds: number[]): Promise<Issue[]> {
    const found: Issue[] = []
    const seen = new Set(rootIds)
    let parentIds = rootIds
    for (let level = 0; level < TREE_SUBTASK_LEVELS && parentIds.length; level++) {
        // Redmine reads every number in parent_id ("1,2,3").
        const rawQuery = new URLSearchParams({ parent_id: parentIds.join(','), status_id: '*' }).toString()
        const page = await gateway.listIssues({ rawQuery }, MAX_SUBTASKS_PER_LEVEL)
        const fresh = page.items.filter((issue) => !seen.has(issue.id))
        for (const issue of fresh) seen.add(issue.id)
        found.push(...fresh)
        parentIds = fresh.map((issue) => issue.id)
    }
    return found
}

/** The issue with its parent, related issues and subtasks, for changing them together. */
export async function loadIssueTree(gateway: RedmineGateway, issueId: number): Promise<IssueTreeNode[]> {
    const opened = await gateway.getIssue(issueId)
    const roots = treeRoots(opened)
    const rootIssues = await issuesByIds(
        gateway,
        roots.map((root) => root.id)
    )
    const byId = new Map(rootIssues.map((issue) => [issue.id, issue]))
    byId.set(opened.id, opened)
    const visibleRoots = roots.flatMap((root) => {
        const issue = byId.get(root.id)
        return issue ? [{ ...root, issue }] : []
    })
    const children = await subtasksOf(
        gateway,
        visibleRoots.map((root) => root.issue.id)
    )
    return buildIssueTree(visibleRoots, children)
}

export class BulkEditUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    /**
     * One issue at a time, so the screen shows progress and retries only what failed. Only the fields that differ
     * are sent; the issue is read again because Redmine silently ignores what the workflow does not allow.
     */
    async execute(issueId: number, change: BulkChange): Promise<BulkEditResult> {
        const current = await this.gateway.getIssue(issueId)
        const diff = bulkDiff(current, change)
        if (isEmptyChange(diff)) return { outcome: 'unchanged', ignored: [] }
        await this.gateway.updateIssue(issueId, diff)
        const saved = await this.gateway.getIssue(issueId)
        const ignored = unappliedFields(diff, saved)
        return { outcome: ignored.length ? 'partial' : 'applied', ignored }
    }
}
