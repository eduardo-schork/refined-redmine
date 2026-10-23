import { describe, expect, it } from 'vitest'
import type { Issue } from '@domain/redmine/entities'
import { DEFAULT_ISSUE_STYLE } from '@domain/redmine/issue-style'
import { resolveColors } from '@domain/settings/colors'
import { cardAccentStyle, colorTokensCss, statusColor } from './issue-colors'

const issue = {
    id: 1,
    tracker: { id: 3, name: 'Bug' },
    status: { id: 2, name: 'Em andamento', is_closed: false },
    priority: { id: 5, name: 'Urgente' }
} as Issue

describe('cardAccentStyle', () => {
    it('shows the priority by default, with no tint', () => {
        expect(cardAccentStyle(issue, DEFAULT_ISSUE_STYLE)).toMatchObject({
            borderLeftColor: 'var(--pr-urgent)',
            backgroundColor: undefined
        })
    })

    it('shows the status or the tracker, tinted when asked', () => {
        const byStatus = cardAccentStyle(issue, { ...DEFAULT_ISSUE_STYLE, cardAccent: 'status', cardTint: true })
        expect(byStatus.borderLeftColor).toBe('var(--st-progress)')
        expect(byStatus.backgroundColor).toContain('var(--st-progress)')
        const byTracker = cardAccentStyle(issue, { ...DEFAULT_ISSUE_STYLE, cardAccent: 'tracker' })
        expect(byTracker).toMatchObject({ '--tracker-base': '#d14343', borderLeftColor: 'var(--tracker)' })
    })

    it('has no stripe for normal priority or "none"', () => {
        const normal = { ...issue, priority: { id: 4, name: 'Normal' } }
        expect(cardAccentStyle(normal, DEFAULT_ISSUE_STYLE)).not.toHaveProperty('borderLeftColor')
        expect(cardAccentStyle(issue, { ...DEFAULT_ISSUE_STYLE, cardAccent: 'none' })).not.toHaveProperty(
            'borderLeftColor'
        )
    })
})

describe('custom status and priority colors', () => {
    const rules = { ...DEFAULT_ISSUE_STYLE, statusColors: { 2: '#000000' }, priorityColors: { 5: '#ffffff' } }

    it('win over the family and level colors, lightened on the dark theme', () => {
        expect(statusColor(issue.status, rules)).toBe('light-dark(#000000, #383838)')
        expect(statusColor({ ...issue.status, id: 9 }, rules)).toBe('var(--st-progress)')
        expect(cardAccentStyle(issue, rules).borderLeftColor).toBe('light-dark(#ffffff, #ffffff)')
    })

    it('a normal priority gets a stripe only when it has its own color', () => {
        const normal = { ...issue, priority: { id: 4, name: 'Normal' } }
        expect(cardAccentStyle(normal, rules)).not.toHaveProperty('borderLeftColor')
        const withColor = { ...rules, priorityColors: { 4: '#ffffff' } }
        expect(cardAccentStyle(normal, withColor).borderLeftColor).toBe('light-dark(#ffffff, #ffffff)')
    })
})

describe('colorTokensCss', () => {
    it('declares every color for the light and the dark theme', () => {
        const css = colorTokensCss(resolveColors('default', { 'pr-urgent': '#000000' }))
        expect(css).toContain('--pr-urgent: #000000;')
        expect(css).toContain('--pr-urgent: #383838;')
        expect(css).toContain('prefers-color-scheme: dark')
    })
})
