import type { Issue } from '../redmine/entities'

/** Result of a monitor's source in the previous cycle. */
export interface QuerySnapshot {
    count: number
    ids: number[]
    /** Subjects, so an issue that left can still be named without a new request. */
    subjects?: Record<number, string>
}

export interface MembershipChange {
    from: number
    to: number
    entered: number[]
    left: number[]
}

export function snapshotOf(total: number, issues: Issue[]): QuerySnapshot {
    const subjects: Record<number, string> = {}
    for (const issue of issues) subjects[issue.id] = issue.subject
    return { count: total, ids: issues.map((issue) => issue.id), subjects }
}

/** A partial page (more results than were fetched) cannot tell who left: the missing ones may just be further down. */
export const isComplete = (snapshot: QuerySnapshot) => snapshot.ids.length >= snapshot.count

/**
 * Which issues entered and left the source since the previous cycle. No previous snapshot: nothing (first run).
 * With a partial page, only the count is compared.
 */
export function diffMembership(previous: QuerySnapshot | undefined, current: QuerySnapshot): MembershipChange | null {
    if (!previous) return null
    const bothComplete = isComplete(previous) && isComplete(current)
    const previousIds = new Set(previous.ids)
    const currentIds = new Set(current.ids)
    const entered = bothComplete ? current.ids.filter((id) => !previousIds.has(id)) : []
    const left = bothComplete ? previous.ids.filter((id) => !currentIds.has(id)) : []

    const countChanged = previous.count !== current.count
    const setChanged = entered.length > 0 || left.length > 0
    if (!countChanged && !setChanged) return null
    return { from: previous.count, to: current.count, entered, left }
}
