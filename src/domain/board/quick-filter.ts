import type { Issue } from '../redmine/entities'
import { foldForSearch } from '../shared/text'

/** Value used for "no assignee" / "no version" in the filter lists. */
export const NONE = 'none'

/**
 * Quick filters of a board or list. Each list is a set of allowed values; an empty list means "all".
 * Values are ids as text ("none" for no assignee / no version) so they can be stored and compared simply.
 */
export interface QuickFilter {
    search: string
    assignees: string[]
    trackers: string[]
    statuses: string[]
    versions: string[]
}

export const EMPTY_QUICK_FILTER: QuickFilter = { search: '', assignees: [], trackers: [], statuses: [], versions: [] }

export type QuickFilterField = Exclude<keyof QuickFilter, 'search'>

export interface FilterOption {
    value: string
    label: string
    count: number
}

const VALUE_OF: Record<QuickFilterField, (issue: Issue) => string> = {
    assignees: (issue) => (issue.assigned_to ? String(issue.assigned_to.id) : NONE),
    trackers: (issue) => String(issue.tracker.id),
    statuses: (issue) => String(issue.status.id),
    versions: (issue) => (issue.fixed_version ? String(issue.fixed_version.id) : NONE)
}

const LABEL_OF: Record<QuickFilterField, (issue: Issue) => string | undefined> = {
    assignees: (issue) => issue.assigned_to?.name,
    trackers: (issue) => issue.tracker.name,
    statuses: (issue) => issue.status.name,
    versions: (issue) => issue.fixed_version?.name
}

export function filterValue(issue: Issue, field: QuickFilterField): string {
    return VALUE_OF[field](issue)
}

/** Title, number or project contains the text, ignoring case and accents. */
function matchesSearch(issue: Issue, search: string): boolean {
    const term = foldForSearch(search.trim().replace(/^#/, ''))
    if (!term) return true
    const haystack = foldForSearch(`${issue.id} ${issue.subject} ${issue.project.name}`)
    return haystack.includes(term)
}

const FIELDS: QuickFilterField[] = ['assignees', 'trackers', 'statuses', 'versions']

export function matchesQuickFilter(issue: Issue, filter: QuickFilter): boolean {
    const allowed = (field: QuickFilterField) => !filter[field].length || filter[field].includes(VALUE_OF[field](issue))
    return matchesSearch(issue, filter.search) && FIELDS.every(allowed)
}

export function isFilterActive(filter: QuickFilter): boolean {
    return Boolean(filter.search.trim()) || FIELDS.some((field) => filter[field].length > 0)
}

/**
 * The values present in the issues, with how many issues each has, by most issues first ("none" last).
 * `noneLabel` names the missing assignee/version.
 */
export function filterOptions(issues: Issue[], field: QuickFilterField, noneLabel: string): FilterOption[] {
    const options = new Map<string, FilterOption>()
    for (const issue of issues) {
        const value = VALUE_OF[field](issue)
        const option = options.get(value) ?? { value, label: LABEL_OF[field](issue) ?? noneLabel, count: 0 }
        option.count += 1
        options.set(value, option)
    }
    const noneLast = (option: FilterOption) => (option.value === NONE ? 1 : 0)
    return [...options.values()].sort(
        (first, second) =>
            noneLast(first) - noneLast(second) || second.count - first.count || first.label.localeCompare(second.label)
    )
}

/** A filter read from storage, with anything unexpected dropped. */
export function withQuickFilterDefaults(loaded: unknown): QuickFilter {
    if (!loaded || typeof loaded !== 'object') return EMPTY_QUICK_FILTER
    const stored = loaded as Partial<Record<keyof QuickFilter, unknown>>
    const textList = (value: unknown) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [])
    return {
        search: typeof stored.search === 'string' ? stored.search : '',
        assignees: textList(stored.assignees),
        trackers: textList(stored.trackers),
        statuses: textList(stored.statuses),
        versions: textList(stored.versions)
    }
}
