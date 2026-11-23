import type { RelatedStatusRule } from './monitor'

/** Links of an issue of the source to the related issues of the rule's tracker, as found at `checkedAt`. */
export interface RelatedLinks {
    relatedIds: number[]
    checkedAt: string
    /** The issue's `updated_on` when the links were looked for: a new relation changes it. */
    issueUpdatedOn?: string
}

/** Last status seen of a related issue. */
export interface RelatedSeen {
    statusId: number
    subject: string
}

/**
 * What a monitor with a related-status rule keeps between cycles: the links of each issue of the source (costly to
 * find, so kept) and the last status of each related issue (to notice when it changes).
 */
export interface RelatedWatch {
    /** Tracker the links were looked for: choosing another one starts over. */
    trackerId: number
    links: Record<string, RelatedLinks>
    related: Record<string, RelatedSeen>
}

export interface RelatedIssueNow extends RelatedSeen {
    id: number
}

export interface RelatedStatusChange {
    relatedId: number
    fromStatusId: number
    toStatusId: number
}

/** A related issue in one of the rule's statuses, shown on the card of the issue it is linked to. */
export interface RelatedMark {
    issueId: number
    relatedId: number
    relatedSubject: string
    trackerId: number
    statusId: number
}

/** Links are looked for again after this time, as relations may be added to the issues in between. */
export const RELATED_LINKS_TTL_MS = 6 * 60 * 60 * 1000

export const emptyWatch = (trackerId: number): RelatedWatch => ({ trackerId, links: {}, related: {} })

/** The stored watch, or an empty one when there is none or it was made for another tracker. */
export function watchFor(stored: RelatedWatch | undefined, rule: RelatedStatusRule): RelatedWatch {
    if (!stored || stored.trackerId !== rule.trackerId) return emptyWatch(rule.trackerId)
    return stored
}

/** Keeps only the issues still in the source, and the related issues still linked to one of them. */
export function pruneWatch(watch: RelatedWatch, sourceIds: number[]): RelatedWatch {
    const inSource = new Set(sourceIds.map(String))
    const links = Object.fromEntries(Object.entries(watch.links).filter(([issueId]) => inSource.has(issueId)))
    const linked = new Set(Object.values(links).flatMap((entry) => entry.relatedIds.map(String)))
    const related = Object.fromEntries(Object.entries(watch.related).filter(([relatedId]) => linked.has(relatedId)))
    return { ...watch, links, related }
}

function needsRefresh(entry: RelatedLinks | undefined, updatedOn: string | undefined, now: Date): boolean {
    if (!entry) return true
    const changedSince = updatedOn !== undefined && updatedOn !== entry.issueUpdatedOn
    const age = now.getTime() - new Date(entry.checkedAt).getTime()
    return changedSince || age > RELATED_LINKS_TTL_MS
}

/**
 * Issues of the source whose links must be looked for: never looked for, changed since (a relation may have been
 * added) or looked for more than 6 h ago. Never looked for first, then the oldest look-ups.
 */
export function linksToRefresh(
    watch: RelatedWatch,
    sourceIssues: { id: number; updatedOn?: string }[],
    now: Date
): number[] {
    const stale = sourceIssues.filter((issue) => needsRefresh(watch.links[issue.id], issue.updatedOn, now))
    const checkedAt = (issueId: number) => watch.links[issueId]?.checkedAt ?? ''
    return stale.map((issue) => issue.id).sort((first, second) => checkedAt(first).localeCompare(checkedAt(second)))
}

export function withLinks(watch: RelatedWatch, issueId: number, links: RelatedLinks): RelatedWatch {
    return { ...watch, links: { ...watch.links, [issueId]: links } }
}

export function linkedRelatedIds(watch: RelatedWatch): number[] {
    const ids = Object.values(watch.links).flatMap((entry) => entry.relatedIds)
    return [...new Set(ids)]
}

/** Issues of the source linked to a related issue. */
export function issuesLinkedTo(watch: RelatedWatch, relatedId: number): number[] {
    return Object.entries(watch.links)
        .filter(([, entry]) => entry.relatedIds.includes(relatedId))
        .map(([issueId]) => Number(issueId))
}

/**
 * Related issues that went to one of the rule's statuses since the last cycle. One seen for the first time only
 * starts being watched: its current status is not news.
 */
export function relatedStatusChanges(
    watch: RelatedWatch,
    current: RelatedIssueNow[],
    rule: RelatedStatusRule
): RelatedStatusChange[] {
    return current.flatMap((issue) => {
        const previous = watch.related[issue.id]
        if (!previous || previous.statusId === issue.statusId) return []
        if (!rule.statusIds.includes(issue.statusId)) return []
        return [{ relatedId: issue.id, fromStatusId: previous.statusId, toStatusId: issue.statusId }]
    })
}

/** Stores the statuses seen now. A related issue that could not be read keeps its last status. */
export function withRelatedSeen(watch: RelatedWatch, current: RelatedIssueNow[]): RelatedWatch {
    const related = { ...watch.related }
    for (const issue of current) related[issue.id] = { statusId: issue.statusId, subject: issue.subject }
    return { ...watch, related }
}

/** For the cards: each issue of the source with a related issue currently in one of the rule's statuses. */
export function relatedMarks(watch: RelatedWatch, rule: RelatedStatusRule): RelatedMark[] {
    return Object.entries(watch.links).flatMap(([issueId, entry]) =>
        entry.relatedIds.flatMap((relatedId) => {
            const seen = watch.related[relatedId]
            if (!seen || !rule.statusIds.includes(seen.statusId)) return []
            return [
                {
                    issueId: Number(issueId),
                    relatedId,
                    relatedSubject: seen.subject,
                    trackerId: rule.trackerId,
                    statusId: seen.statusId
                }
            ]
        })
    )
}
