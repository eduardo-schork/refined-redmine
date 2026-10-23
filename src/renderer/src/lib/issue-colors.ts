import type { CSSProperties } from 'react'
import type { Issue, IssueStatus, Named } from '@domain/redmine/entities'
import { priorityLevel, type PriorityLevel } from '@domain/redmine/issue-signals'
import type { IssueStyleRules } from '@domain/redmine/issue-style'
import { statusTone } from '@domain/redmine/status-tone'
import { trackerColor } from '@domain/redmine/tracker-color'
import { COLOR_KEYS, darkThemeAccent, type ColorKey, type ThemeColor } from '@domain/settings/colors'

/** Stylesheet with the light and dark value of every issue and message color, as CSS custom properties. */
export function colorTokensCss(colors: Record<ColorKey, ThemeColor>): string {
    const declarations = (theme: keyof ThemeColor) =>
        COLOR_KEYS.map((key) => `--${key}: ${colors[key][theme]};`).join(' ')
    return `:root { ${declarations('light')} }\n@media (prefers-color-scheme: dark) { :root { ${declarations('dark')} } }`
}

/** Inline style that gives an element (and its children) the tracker color as var(--tracker); needs .tracker-color. */
export function trackerColorStyle(tracker: Named, rules: IssueStyleRules): CSSProperties {
    return { '--tracker-base': trackerColor(tracker, rules) } as CSSProperties
}

/** A color chosen by the user, lightened on the dark theme like the accent (light-dark() follows color-scheme). */
export function adaptiveColor(hex: string): string {
    return `light-dark(${hex}, ${darkThemeAccent(hex)})`
}

/** The status color the user picked for this status id, if any. */
export function customStatusColor(statusId: number, rules: IssueStyleRules): string | undefined {
    const hex = rules.statusColors[statusId]
    return hex ? adaptiveColor(hex) : undefined
}

/** The priority color the user picked for this priority id, if any. */
export function customPriorityColor(priorityId: number, rules: IssueStyleRules): string | undefined {
    const hex = rules.priorityColors[priorityId]
    return hex ? adaptiveColor(hex) : undefined
}

/** CSS color of a status: the user's color for it, or the color of its family. */
export function statusColor(status: IssueStatus, rules: IssueStyleRules): string {
    return customStatusColor(status.id, rules) ?? `var(--st-${statusTone(status, rules)})`
}

/** Soft background and text in a color, as the status and priority chips use. */
export function softChipStyle(color: string): CSSProperties {
    return { backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }
}

// Normal priority has no stripe, so the ones that matter stand out.
const PRIORITY_ACCENT: Record<PriorityLevel, string | undefined> = {
    urgent: 'var(--pr-urgent)',
    high: 'var(--pr-high)',
    normal: undefined,
    low: 'var(--pr-low)'
}

/** The user's color for the priority (even a normal one: picking a color means "show it"), else the level's. */
export function priorityColor(priority: Named, rules: IssueStyleRules): string | undefined {
    return customPriorityColor(priority.id, rules) ?? PRIORITY_ACCENT[priorityLevel(priority, rules)]
}

/** CSS color of the card stripe (and tint), or undefined for none. */
export function cardAccentColor(issue: Issue, rules: IssueStyleRules): string | undefined {
    switch (rules.cardAccent) {
        case 'priority':
            return priorityColor(issue.priority, rules)
        case 'status':
            return statusColor(issue.status, rules)
        case 'tracker':
            return 'var(--tracker)'
        case 'none':
            return undefined
    }
}

const TINT_PERCENT = 8

/**
 * Stripe color and, when the user turned it on, a light tint of the same color on the background. The card carries
 * its tracker color (.tracker-color), so "tracker" works too.
 */
export function cardAccentStyle(issue: Issue, rules: IssueStyleRules): CSSProperties {
    const tracker = trackerColorStyle(issue.tracker, rules)
    const accent = cardAccentColor(issue, rules)
    if (!accent) return tracker
    const tint = rules.cardTint ? `color-mix(in srgb, ${accent} ${TINT_PERCENT}%, var(--panel))` : undefined
    return { ...tracker, borderLeftColor: accent, backgroundColor: tint }
}
