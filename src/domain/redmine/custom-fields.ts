import type { CustomFieldValue, Issue } from './entities'

/** A custom field offered when creating an issue, learned from the project's recent issues of the same tracker. */
export interface CustomFieldUsage {
    id: number
    name: string
    /** Filled in every recent issue of the tracker: taken as required by Redmine. */
    required: boolean
    /** Values already used, most frequent first. */
    suggestions: string[]
}

/** The fields of each tracker (by id) and, for trackers without recent issues, every field seen in the project. */
export interface ProjectCustomFields {
    byTracker: Record<number, CustomFieldUsage[]>
    all: CustomFieldUsage[]
}

/** A custom field value sent with a new issue. */
export interface CustomFieldEntry {
    id: number
    value: string
}

/** How many recent issues are read to learn the fields. */
export const CUSTOM_FIELD_SAMPLE = 100
/** With fewer issues of a tracker, "always filled" proves nothing and no field is marked as required. */
const MIN_ISSUES_FOR_REQUIRED = 3
const MAX_SUGGESTIONS = 50
const CHECKBOX_VALUES = new Set(['0', '1'])

interface FieldTally {
    id: number
    name: string
    filled: number
    counts: Map<string, number>
}

const singleValue = (field: CustomFieldValue) => (typeof field.value === 'string' ? field.value.trim() : '')

/**
 * Redmine only lets administrators read the custom field definitions, so they are learned from the project's
 * recent issues: Redmine lists in each issue the fields of its tracker. Multi-value fields and checkboxes (only
 * 0/1, which Redmine fills with its default) are left out, as are fields nobody fills.
 */
export function projectCustomFields(issues: Issue[]): ProjectCustomFields {
    const byTracker = new Map<number, Issue[]>()
    for (const issue of issues) byTracker.set(issue.tracker.id, [...(byTracker.get(issue.tracker.id) ?? []), issue])
    const trackerFields = [...byTracker].map(([trackerId, trackerIssues]) => [trackerId, usage(trackerIssues)])
    const all = usage(issues).map((field) => ({ ...field, required: false }))
    return { byTracker: Object.fromEntries(trackerFields), all }
}

export function trackerCustomFields(fields: ProjectCustomFields, trackerId: number | undefined): CustomFieldUsage[] {
    if (trackerId === undefined) return []
    return fields.byTracker[trackerId] ?? fields.all
}

function usage(issues: Issue[]): CustomFieldUsage[] {
    const tallies = tallyFields(issues)
    const canTellRequired = issues.length >= MIN_ISSUES_FOR_REQUIRED
    const fields = [...tallies.values()].filter((tally) => tally.filled > 0 && !isCheckbox(tally))
    const usages = fields.map((tally) => ({
        id: tally.id,
        name: tally.name,
        required: canTellRequired && tally.filled === issues.length,
        suggestions: mostFrequentFirst(tally.counts)
    }))
    return [...usages.filter((field) => field.required), ...usages.filter((field) => !field.required)]
}

function tallyFields(issues: Issue[]): Map<number, FieldTally> {
    const tallies = new Map<number, FieldTally>()
    for (const issue of issues) {
        for (const field of issue.custom_fields ?? []) {
            if (Array.isArray(field.value)) continue
            const tally = tallies.get(field.id) ?? { id: field.id, name: field.name, filled: 0, counts: new Map() }
            tallies.set(field.id, tally)
            const value = singleValue(field)
            if (!value) continue
            tally.filled += 1
            tally.counts.set(value, (tally.counts.get(value) ?? 0) + 1)
        }
    }
    return tallies
}

const isCheckbox = (tally: FieldTally) => [...tally.counts.keys()].every((value) => CHECKBOX_VALUES.has(value))

function mostFrequentFirst(counts: Map<string, number>): string[] {
    const byFrequency = [...counts].sort(([firstValue, first], [secondValue, second]) => {
        return second - first || firstValue.localeCompare(secondValue)
    })
    return byFrequency.slice(0, MAX_SUGGESTIONS).map(([value]) => value)
}

/** The parent's single values, copied to a new subtask. */
export function inheritedCustomFields(fields: CustomFieldValue[] = []): CustomFieldEntry[] {
    return fields.map((field) => ({ id: field.id, value: singleValue(field) })).filter((entry) => entry.value)
}

/** What is sent: only the tracker's fields, only when filled. */
export function customFieldEntries(fields: CustomFieldUsage[], values: Record<number, string>): CustomFieldEntry[] {
    const entries = fields.map((field) => ({ id: field.id, value: (values[field.id] ?? '').trim() }))
    return entries.filter((entry) => entry.value)
}
