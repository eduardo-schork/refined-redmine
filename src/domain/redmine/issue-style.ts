import { isHexColor } from '../settings/colors'
import type { PriorityLevel } from './issue-signals'
import type { StatusTone } from './status-tone'

export const STATUS_TONES: StatusTone[] = ['new', 'progress', 'review', 'testing', 'blocked', 'done', 'rejected']
export const PRIORITY_LEVELS: PriorityLevel[] = ['urgent', 'high', 'normal', 'low']

/** What the colored stripe on the left of a card shows. */
export type CardAccent = 'priority' | 'status' | 'tracker' | 'none'
export const CARD_ACCENTS: CardAccent[] = ['priority', 'status', 'tracker', 'none']

/**
 * How issues are highlighted. Statuses and priorities not listed here keep the level/color inferred from their
 * name; the user only lists the ones the inference gets wrong.
 */
export interface IssueStyleRules {
    /** Status id → color family. */
    statusTones: Record<number, StatusTone>
    /** Status id → hex color (#rrggbb) chosen by the user; wins over the color of the family. */
    statusColors: Record<number, string>
    /** Priority id → level. */
    priorityLevels: Record<number, PriorityLevel>
    /** Priority id → hex color (#rrggbb) chosen by the user; wins over the color of the level. */
    priorityColors: Record<number, string>
    /** A due date this close (in days) is highlighted as "due soon". */
    dueSoonDays: number
    /** Tracker id → hex color (#rrggbb); trackers not listed get a color inferred from the name. */
    trackerColors: Record<number, string>
    cardAccent: CardAccent
    /** Tints the card background with the color of the stripe. */
    cardTint: boolean
}

export const MAX_DUE_SOON_DAYS = 30

export const DEFAULT_ISSUE_STYLE: IssueStyleRules = {
    statusTones: {},
    statusColors: {},
    priorityLevels: {},
    priorityColors: {},
    dueSoonDays: 3,
    trackerColors: {},
    cardAccent: 'priority',
    cardTint: false
}

function validEntries<T>(loaded: unknown, isAllowed: (value: unknown) => boolean): Record<number, T> {
    if (!loaded || typeof loaded !== 'object') return {}
    const entries = Object.entries(loaded).filter(([id, value]) => Number.isInteger(Number(id)) && isAllowed(value))
    return Object.fromEntries(entries.map(([id, value]) => [Number(id), value as T]))
}

const oneOf =
    <T>(allowed: readonly T[]) =>
    (value: unknown) =>
        allowed.includes(value as T)

const isHexValue = (value: unknown) => typeof value === 'string' && isHexColor(value)

function validDueSoonDays(value: unknown): number {
    const days = Number(value)
    if (!Number.isInteger(days) || days < 0 || days > MAX_DUE_SOON_DAYS) return DEFAULT_ISSUE_STYLE.dueSoonDays
    return days
}

function validCardAccent(value: unknown): CardAccent {
    return CARD_ACCENTS.includes(value as CardAccent) ? (value as CardAccent) : DEFAULT_ISSUE_STYLE.cardAccent
}

/** Invalid values from the file are dropped, so a bad edit never breaks the UI. */
export function withIssueStyleDefaults(loaded: Partial<IssueStyleRules> = {}): IssueStyleRules {
    return {
        statusTones: validEntries(loaded.statusTones, oneOf(STATUS_TONES)),
        statusColors: validEntries(loaded.statusColors, isHexValue),
        priorityLevels: validEntries(loaded.priorityLevels, oneOf(PRIORITY_LEVELS)),
        priorityColors: validEntries(loaded.priorityColors, isHexValue),
        dueSoonDays: validDueSoonDays(loaded.dueSoonDays ?? DEFAULT_ISSUE_STYLE.dueSoonDays),
        trackerColors: validEntries(loaded.trackerColors, isHexValue),
        cardAccent: validCardAccent(loaded.cardAccent),
        cardTint: Boolean(loaded.cardTint)
    }
}
