import type { IssueDetail, Journal } from '../redmine/entities'
import type { TimeEntry } from '../time/time-entry'

export type SinceKind = 'status' | 'comment' | 'changes' | 'timeEntry' | 'created'

/** A moment of the issue the hours of a trâmite can be counted from. */
export interface SinceOption {
    key: string
    kind: SinceKind
    /** ISO date and time. */
    at: string
    who: string
    mine: boolean
    /** Hours of a time entry. */
    hours?: number
}

function journalKind(journal: Journal): SinceKind {
    if (journal.details.some((detail) => detail.name === 'status_id')) return 'status'
    if (!journal.details.length) return 'comment'
    return 'changes'
}

/**
 * Every journal of the issue, the time logged on it and its creation, newest first. Time entries count from when
 * they were logged.
 */
export function hoursSinceOptions(
    issue: Pick<IssueDetail, 'id' | 'journals' | 'created_on' | 'author'>,
    entries: TimeEntry[],
    userId: number | undefined
): SinceOption[] {
    const journals = issue.journals.map((journal) => ({
        key: `journal:${journal.id}`,
        kind: journalKind(journal),
        at: journal.created_on,
        who: journal.user.name,
        mine: journal.user.id === userId
    }))
    const logged = entries
        .filter((entry) => entry.issue?.id === issue.id)
        .map((entry) => ({
            key: `time:${entry.id}`,
            kind: 'timeEntry' as const,
            at: entry.created_on,
            who: entry.user.name,
            mine: entry.user.id === userId,
            hours: entry.hours
        }))
    const created = {
        key: 'created',
        kind: 'created' as const,
        at: issue.created_on,
        who: issue.author.name,
        mine: issue.author.id === userId
    }
    const options: SinceOption[] = [...journals, ...logged, created]
    return options.sort((first, second) => second.at.localeCompare(first.at))
}

/** The user's last trâmite on the issue; then the last status change; then the creation. */
export function defaultSince(options: SinceOption[]): SinceOption | undefined {
    const mine = options.find((option) => option.mine && option.kind !== 'created')
    const statusChange = options.find((option) => option.kind === 'status')
    return mine ?? statusChange ?? options.find((option) => option.kind === 'created')
}
