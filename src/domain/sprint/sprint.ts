import type { Version } from '../redmine/entities'

/**
 * Team convention:
 * - Sprint: version "X.Y" (e.g. 3.78). Cycle: development → dev deadline → QA (staging) → release.
 * - Hotfix: version "X.Y.Z" (e.g. 3.77.1) — fixes on the quality (staging) branch of sprint X.Y.
 * - Other versions (backlog, site, …) are groupings.
 */
export type SprintKind = 'sprint' | 'hotfix' | 'other'
export type SprintPhase = 'dev' | 'qa' | 'late' | 'planned' | 'production' | 'hotfix' | 'released' | 'other'
export type SprintAutoPick = 'dev' | 'qa' | 'hotfix'

export interface Sprint {
    version: Version
    kind: SprintKind
    phase: SprintPhase
    devDeadline?: string
    release?: string
    /**
     * Estimated start of development: the day after the previous sprint's dev deadline (sprints follow each other).
     * Redmine has no start date for a version.
     */
    devStart?: string
    /** For hotfixes: name of the source sprint (3.77.1 → 3.77). */
    baseName?: string
}

/** Where the dates live and how to recognize sprints/hotfixes by name. */
export interface SprintConventions {
    projectId?: number
    devDeadlineFieldId?: number
    releaseFieldId?: number
    sprintPattern: string
    hotfixPattern: string
}

export const DEFAULT_SPRINT_CONVENTIONS: SprintConventions = {
    sprintPattern: '^\\d+\\.\\d+$',
    hotfixPattern: '^\\d+\\.\\d+\\.\\d+$'
}

export interface VersionStats {
    total: number
    open: number
    mineOpen: number
}

export const ACTIVE_PHASES: SprintPhase[] = ['production', 'hotfix', 'late', 'qa', 'dev', 'planned']
