import { safeRegex } from '../shared/text'
import type { LocalDate } from '../shared/date'
import type { Version } from '../redmine/entities'
import {
    ACTIVE_PHASES,
    type Sprint,
    type SprintAutoPick,
    type SprintConventions,
    type SprintKind,
    type SprintPhase
} from './sprint'

function versionNumber(name: string): number[] {
    return name.split('.').map((part) => Number(part) || 0)
}

/** Sorts "3.9" < "3.10" < "3.10.1". */
export function compareVersions(first: string, second: string): number {
    const firstParts = versionNumber(first)
    const secondParts = versionNumber(second)
    const length = Math.max(firstParts.length, secondParts.length)
    for (let index = 0; index < length; index++) {
        const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0)
        if (difference) return difference
    }
    return 0
}

function customValue(version: Version, fieldId?: number): string | undefined {
    if (!fieldId) return undefined
    const field = version.custom_fields?.find((customField) => customField.id === fieldId)
    const rawValue = field?.value
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    return value ? String(value) : undefined
}

export interface DetectedFields {
    fields: { id: number; name: string }[]
    devDeadlineFieldId?: number
    releaseFieldId?: number
}

/**
 * Suggests the date fields from the names of the versions' custom fields.
 * The regexes match Redmine field names in Portuguese or English (e.g. 'Prazo dos devs', 'Publicação').
 */
export function detectDateFields(versions: Version[]): DetectedFields {
    const namesById = new Map<number, string>()
    for (const version of versions) {
        for (const field of version.custom_fields ?? []) namesById.set(field.id, field.name)
    }
    const fields = [...namesById].map(([id, name]) => ({ id, name }))
    const devDeadlineField = fields.find((field) => /limite|dev/i.test(field.name))
    const releaseField = fields.find((field) => /publica|lança|release|deploy/i.test(field.name))
    return {
        fields,
        devDeadlineFieldId: devDeadlineField?.id,
        releaseFieldId: releaseField?.id
    }
}

function sprintKind(name: string, sprintPattern: RegExp, hotfixPattern: RegExp): SprintKind {
    if (hotfixPattern.test(name)) return 'hotfix'
    if (sprintPattern.test(name)) return 'sprint'
    return 'other'
}

interface DateFieldIds {
    devField?: number
    releaseField?: number
}

function toSprint(version: Version, kind: SprintKind, dateFields: DateFieldIds): Sprint {
    const baseName = kind === 'hotfix' ? version.name.split('.').slice(0, 2).join('.') : undefined
    return {
        version,
        kind,
        phase: 'other',
        devDeadline: customValue(version, dateFields.devField),
        release: customValue(version, dateFields.releaseField) ?? version.due_date ?? undefined,
        baseName
    }
}

function byDevDeadlineThenVersion(first: Sprint, second: Sprint): number {
    const byDeadline = first.devDeadline!.localeCompare(second.devDeadline!)
    if (byDeadline) return byDeadline
    return compareVersions(first.version.name, second.version.name)
}

function byLatestReleaseThenVersion(first: Sprint, second: Sprint): number {
    const byRelease = second.release!.localeCompare(first.release!)
    if (byRelease) return byRelease
    return compareVersions(second.version.name, first.version.name)
}

/** The open sprint with the nearest dev deadline that has not passed yet. */
function currentDevSprint(openSprints: Sprint[], today: LocalDate): Sprint | undefined {
    const upcoming = openSprints.filter((sprint) => sprint.devDeadline && sprint.devDeadline >= today)
    return upcoming.sort(byDevDeadlineThenVersion)[0]
}

function openSprintPhase(sprint: Sprint, devSprint: Sprint | undefined, today: LocalDate): SprintPhase {
    if (sprint.release && sprint.release < today) return 'late'
    if (sprint.devDeadline && sprint.devDeadline < today) return 'qa'
    if (sprint === devSprint) return 'dev'
    return 'planned'
}

/** The last closed sprint already released. */
function productionSprint(closedSprints: Sprint[], today: LocalDate): Sprint | undefined {
    const released = closedSprints.filter((sprint) => sprint.release && sprint.release <= today)
    return released.sort(byLatestReleaseThenVersion)[0]
}

/**
 * Classifies versions into sprints/hotfixes/groupings and computes the phase of each one.
 * - In development: open sprint with the nearest dev deadline that has not passed yet.
 * - In QA (staging): open, dev deadline passed, release in the future. Late release: the release date has passed.
 * - In production: the last closed sprint already released. Hotfix: open X.Y.Z.
 */
export function classifySprints(versions: Version[], conventions: SprintConventions, today: LocalDate): Sprint[] {
    const detected = detectDateFields(versions)
    const dateFields: DateFieldIds = {
        devField: conventions.devDeadlineFieldId ?? detected.devDeadlineFieldId,
        releaseField: conventions.releaseFieldId ?? detected.releaseFieldId
    }
    const sprintPattern = safeRegex(conventions.sprintPattern, /^\d+\.\d+$/)
    const hotfixPattern = safeRegex(conventions.hotfixPattern, /^\d+\.\d+\.\d+$/)

    const items = versions.map((version) => {
        const kind = sprintKind(version.name, sprintPattern, hotfixPattern)
        return toSprint(version, kind, dateFields)
    })

    const sprints = items.filter((sprint) => sprint.kind === 'sprint')
    const openSprints = sprints.filter((sprint) => sprint.version.status !== 'closed')
    const devSprint = currentDevSprint(openSprints, today)
    for (const sprint of openSprints) sprint.phase = openSprintPhase(sprint, devSprint, today)

    const closedSprints = sprints.filter((sprint) => sprint.version.status === 'closed')
    for (const sprint of closedSprints) sprint.phase = 'released'
    const production = productionSprint(closedSprints, today)
    if (production) production.phase = 'production'

    const hotfixes = items.filter((sprint) => sprint.kind === 'hotfix')
    for (const hotfix of hotfixes) hotfix.phase = hotfix.version.status === 'closed' ? 'released' : 'hotfix'
    return items
}

function byActivePhaseThenVersion(first: Sprint, second: Sprint): number {
    const byPhase = ACTIVE_PHASES.indexOf(first.phase) - ACTIVE_PHASES.indexOf(second.phase)
    if (byPhase) return byPhase
    return compareVersions(first.version.name, second.version.name)
}

/** Active sprints in display order (production, hotfix, QA, development, planned). */
export function activeSprints(all: Sprint[]): Sprint[] {
    return all.filter((sprint) => ACTIVE_PHASES.includes(sprint.phase)).sort(byActivePhaseThenVersion)
}

/** Resolves the "automatic" sprint of a board. */
export function pickSprint(all: Sprint[], auto: SprintAutoPick): Sprint | undefined {
    switch (auto) {
        case 'hotfix': {
            const hotfixes = all.filter((sprint) => sprint.phase === 'hotfix')
            return hotfixes.sort((first, second) => compareVersions(second.version.name, first.version.name))[0]
        }
        case 'qa': {
            const inQa = all.filter((sprint) => sprint.phase === 'qa' || sprint.phase === 'late')
            return inQa.sort((first, second) => compareVersions(first.version.name, second.version.name))[0]
        }
        default:
            return all.find((sprint) => sprint.phase === 'dev')
    }
}
