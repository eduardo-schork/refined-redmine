import type { Issue, IssueDetail, Relation } from './entities'
import { relationFrom, type RelationType } from './relations'

export interface RelationGroup {
    type: RelationType
    issueIds: number[]
}

/** What holds the issue back comes first; plain and historical links last. */
const RELATION_ORDER: RelationType[] = [
    'blocked',
    'blocks',
    'precedes',
    'follows',
    'relates',
    'duplicates',
    'duplicated',
    'copied_from',
    'copied_to'
]

const orderOf = (type: RelationType) => {
    const index = RELATION_ORDER.indexOf(type)
    return index === -1 ? RELATION_ORDER.length : index
}

/** Relations seen from `issueId`, one group per type, in RELATION_ORDER (unknown types at the end). */
export function relationGroups(issueId: number, relations: Relation[]): RelationGroup[] {
    const groups = new Map<RelationType, number[]>()
    for (const relation of relations) {
        const { type, otherId } = relationFrom(issueId, relation)
        const issueIds = groups.get(type) ?? []
        if (!issueIds.includes(otherId)) issueIds.push(otherId)
        groups.set(type, issueIds)
    }
    return [...groups.entries()]
        .map(([type, issueIds]) => ({ type, issueIds }))
        .sort((first, second) => orderOf(first.type) - orderOf(second.type))
}

/** Parent, subtasks and related issues, without repeats: the ones to load to show their status and assignee. */
export function linkedIssueIds(issue: IssueDetail): number[] {
    const parentIds = issue.parent ? [issue.parent.id] : []
    const subtaskIds = issue.children.map((child) => child.id)
    const relatedIds = issue.relations.map((relation) => relationFrom(issue.id, relation).otherId)
    return [...new Set([...parentIds, ...subtaskIds, ...relatedIds])]
}

/** The parent's other subtasks; none until the parent is read. */
export function siblingIds(issue: IssueDetail, parent?: IssueDetail): number[] {
    if (!parent) return []
    return parent.children.map((child) => child.id).filter((id) => id !== issue.id)
}

/** Subtasks already closed, among the ones loaded. */
export function closedSubtaskCount(issue: IssueDetail, loaded: ReadonlyMap<number, Issue>): number {
    return issue.children.filter((child) => loaded.get(child.id)?.status.is_closed).length
}
