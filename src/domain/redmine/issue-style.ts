import type { PriorityLevel } from './issue-signals'
import type { StatusTone } from './status-tone'

export const STATUS_TONES: StatusTone[] = ['new', 'progress', 'review', 'testing', 'blocked', 'done', 'rejected']
export const PRIORITY_LEVELS: PriorityLevel[] = ['urgent', 'high', 'normal', 'low']

/**
 * How issues are highlighted. Statuses and priorities not listed here keep the level/color inferred from their
 * name; the user only lists the ones the inference gets wrong.
 */
export interface IssueStyleRules {
    /** Status id → color family. */
    statusTones: Record<number, StatusTone>
    /** Priority id → level. */
    priorityLevels: Record<number, PriorityLevel>
    /** A due date this close (in days) is highlighted as "due soon". */
    dueSoonDays: number
}

export const MAX_DUE_SOON_DAYS = 30

export const DEFAULT_ISSUE_STYLE: IssueStyleRules = { statusTones: {}, priorityLevels: {}, dueSoonDays: 3 }

function validEntries<T>(loaded: unknown, allowed: readonly T[]): Record<number, T> {
    if (!loaded || typeof loaded !== 'object') return {}
    const entries = Object.entries(loaded).filter(
        ([id, value]) => Number.isInteger(Number(id)) && allowed.includes(value as T)
    )
    return Object.fromEntries(entries.map(([id, value]) => [Number(id), value as T]))
}

function validDueSoonDays(value: unknown): number {
    const days = Number(value)
    if (!Number.isInteger(days) || days < 0 || days > MAX_DUE_SOON_DAYS) return DEFAULT_ISSUE_STYLE.dueSoonDays
    return days
}

/** Invalid values from the file are dropped, so a bad edit never breaks the UI. */
export function withIssueStyleDefaults(loaded: Partial<IssueStyleRules> = {}): IssueStyleRules {
    return {
        statusTones: validEntries(loaded.statusTones, STATUS_TONES),
        priorityLevels: validEntries(loaded.priorityLevels, PRIORITY_LEVELS),
        dueSoonDays: validDueSoonDays(loaded.dueSoonDays ?? DEFAULT_ISSUE_STYLE.dueSoonDays)
    }
}
