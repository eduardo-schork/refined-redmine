import type { IssueDetail, Named } from './entities'

/** Names of what a journal can change by id: Redmine only records the ids. */
export interface JournalNames {
    statuses: ReadonlyMap<number, string>
    priorities: ReadonlyMap<number, string>
    trackers: ReadonlyMap<number, string>
    versions: ReadonlyMap<number, string>
    people: ReadonlyMap<number, string>
    projects: ReadonlyMap<number, string>
}

const NAMES_OF_FIELD: Record<string, keyof JournalNames> = {
    status_id: 'statuses',
    priority_id: 'priorities',
    tracker_id: 'trackers',
    fixed_version_id: 'versions',
    assigned_to_id: 'people',
    project_id: 'projects'
}

export const namesById = (items: Named[] = []): Map<number, string> =>
    new Map(items.map((item) => [item.id, item.name]))

/**
 * A changed value as people read it: the name for an id (`#id` when it is not known, e.g. a category or a person who
 * left the project), `—` when empty, the value itself otherwise.
 */
export function journalValue(fieldName: string, value: string | null | undefined, names: JournalNames): string {
    if (value === null || value === undefined || value === '') return '—'
    const list = NAMES_OF_FIELD[fieldName]
    if (list) return names[list].get(Number(value)) ?? `#${value}`
    if (fieldName.endsWith('_id')) return `#${value}`
    return value
}

/** Everyone the issue mentions: also people no longer in the project, who are missing from its members. */
export function peopleOfIssue(issue: Pick<IssueDetail, 'author' | 'assigned_to' | 'watchers' | 'journals'>): Named[] {
    return [
        issue.author,
        ...(issue.assigned_to ? [issue.assigned_to] : []),
        ...issue.watchers,
        ...issue.journals.map((journal) => journal.user)
    ]
}
