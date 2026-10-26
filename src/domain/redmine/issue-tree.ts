import type { Issue, IssueDetail } from './entities'
import { relationFrom, type RelationType } from './relations'

/** How an issue of the tree relates to the one that was opened. */
export type TreeRole = 'self' | 'parent' | 'related' | 'subtask'

export interface IssueTreeNode {
    issue: Issue
    role: TreeRole
    /** For related issues: the relation seen from the opened issue. */
    relation?: RelationType
    /** 0 for the opened issue, its parent and related issues; +1 per subtask level. */
    depth: number
    /** The tree node this one hangs from (subtasks only). */
    parentId?: number
}

/** Subtask levels read below each root; deeper ones are rare and each level is one more request. */
export const TREE_SUBTASK_LEVELS = 3

/** The roots of the tree: the opened issue, its parent and every related issue. */
export function treeRoots(issue: IssueDetail): { id: number; role: TreeRole; relation?: RelationType }[] {
    const roots: { id: number; role: TreeRole; relation?: RelationType }[] = [{ id: issue.id, role: 'self' }]
    if (issue.parent) roots.push({ id: issue.parent.id, role: 'parent' })
    for (const relation of issue.relations) {
        const { type, otherId } = relationFrom(issue.id, relation)
        roots.push({ id: otherId, role: 'related', relation: type })
    }
    return roots.filter((root, index) => roots.findIndex((other) => other.id === root.id) === index)
}

/**
 * The tree in display order: each root followed by its subtasks (depth first). An issue appears once, in the first
 * place it is found, so the opened issue under its parent is not repeated.
 */
export function buildIssueTree(
    roots: { issue: Issue; role: TreeRole; relation?: RelationType }[],
    children: Issue[]
): IssueTreeNode[] {
    const byParent = new Map<number, Issue[]>()
    for (const child of children) {
        const parentId = child.parent?.id
        if (parentId !== undefined) byParent.set(parentId, [...(byParent.get(parentId) ?? []), child])
    }
    const seen = new Set<number>()
    const nodes: IssueTreeNode[] = []
    const visit = (node: IssueTreeNode) => {
        if (seen.has(node.issue.id)) return
        seen.add(node.issue.id)
        nodes.push(node)
        for (const child of byParent.get(node.issue.id) ?? []) {
            visit({ issue: child, role: 'subtask', depth: node.depth + 1, parentId: node.issue.id })
        }
    }
    const ordered = [...roots].sort((first, second) => ROOT_ORDER[first.role] - ROOT_ORDER[second.role])
    for (const root of ordered) visit({ ...root, depth: 0 })
    return nodes
}

const ROOT_ORDER: Record<TreeRole, number> = { self: 0, parent: 1, related: 2, subtask: 3 }

/** The issue and everything below it in the tree. */
export function subtreeIds(nodes: IssueTreeNode[], id: number): number[] {
    const below = nodes.filter((node) => node.parentId === id).flatMap((node) => subtreeIds(nodes, node.issue.id))
    return [id, ...below]
}

/** How a row hangs in the tree: `last` when no sibling comes after it; `lines[k]` when level k+1 still continues. */
export interface TreeGuide {
    last: boolean
    lines: boolean[]
}

/** Guides to draw the tree like folders ("├─", "└─", "│"), for rows in `buildIssueTree` order. */
export function treeGuides(nodes: IssueTreeNode[]): TreeGuide[] {
    const lastById = new Map<number, boolean>()
    nodes.forEach((node, index) => {
        const laterSibling = nodes.slice(index + 1).some((other) => other.parentId === node.parentId)
        lastById.set(node.issue.id, node.parentId === undefined || !laterSibling)
    })
    const byId = new Map(nodes.map((node) => [node.issue.id, node]))
    return nodes.map((node) => {
        const lines = Array<boolean>(Math.max(0, node.depth - 1)).fill(false)
        for (let ancestor = byId.get(node.parentId ?? -1); ancestor && ancestor.depth > 0;) {
            lines[ancestor.depth - 1] = !lastById.get(ancestor.issue.id)
            ancestor = byId.get(ancestor.parentId ?? -1)
        }
        return { last: lastById.get(node.issue.id) ?? true, lines }
    })
}

/** Checking or unchecking an issue does the same to its subtasks. */
export function toggleSubtree(nodes: IssueTreeNode[], checked: Set<number>, id: number): Set<number> {
    const next = new Set(checked)
    const turnOn = !checked.has(id)
    for (const subtreeId of subtreeIds(nodes, id)) {
        if (turnOn) next.add(subtreeId)
        else next.delete(subtreeId)
    }
    return next
}

/** What to apply to many issues. Undefined keeps the field; null clears it (nobody, no version). */
export interface BulkChange {
    statusId?: number
    assignedToId?: number | null
    fixedVersionId?: number | null
}

/** Only the fields that differ from the issue's current values; empty when nothing would change. */
export function bulkDiff(issue: Issue, change: BulkChange): BulkChange {
    const diff: BulkChange = {}
    if (change.statusId !== undefined && change.statusId !== issue.status.id) diff.statusId = change.statusId
    const assignee = issue.assigned_to?.id ?? null
    if (change.assignedToId !== undefined && change.assignedToId !== assignee) diff.assignedToId = change.assignedToId
    const version = issue.fixed_version?.id ?? null
    if (change.fixedVersionId !== undefined && change.fixedVersionId !== version) {
        diff.fixedVersionId = change.fixedVersionId
    }
    return diff
}

export const isEmptyChange = (change: BulkChange) => Object.keys(change).length === 0

export type BulkField = keyof BulkChange

/** Fields of the change that Redmine did not apply (workflow, read-only field or no permission). */
export function unappliedFields(change: BulkChange, saved: Issue): BulkField[] {
    return (Object.keys(change) as BulkField[]).filter(
        (field) => !isEmptyChange(bulkDiff(saved, { [field]: change[field] }))
    )
}

/** Result of applying a bulk change to one issue. */
export interface BulkEditResult {
    outcome: 'unchanged' | 'applied' | 'partial'
    /** Fields Redmine did not apply (only when partial). */
    ignored: BulkField[]
}

/** A comment with optional status, assignee and version, sent in one update (a handoff). */
export interface IssueNoteChange extends BulkChange {
    notes?: string
}
