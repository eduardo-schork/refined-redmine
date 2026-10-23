import { describe, expect, it } from 'vitest'
import { DEFAULT_ISSUE_STYLE } from './issue-style'
import { inferredTrackerColor, trackerColor } from './tracker-color'

describe('trackerColor', () => {
    it('infers the color from the name, in Portuguese or English', () => {
        expect(inferredTrackerColor({ id: 1, name: 'Bug' })).toBe('#d14343')
        expect(inferredTrackerColor({ id: 2, name: 'Defeito' })).toBe('#d14343')
        expect(inferredTrackerColor({ id: 3, name: 'Feature' })).toBe('#2f6fdb')
        expect(inferredTrackerColor({ id: 4, name: 'Melhoria' })).toBe('#0d9488')
        expect(inferredTrackerColor({ id: 5, name: 'Suporte' })).toBe('#8b5cf6')
    })

    it('gives unknown names a stable color by id', () => {
        const first = inferredTrackerColor({ id: 40, name: 'Xyz' })
        expect(inferredTrackerColor({ id: 40, name: 'Other name' })).toBe(first)
        expect(inferredTrackerColor({ id: 41, name: 'Xyz' })).not.toBe(first)
    })

    it('prefers the color chosen by the user', () => {
        const rules = { ...DEFAULT_ISSUE_STYLE, trackerColors: { 1: '#123456' } }
        expect(trackerColor({ id: 1, name: 'Bug' }, rules)).toBe('#123456')
        expect(trackerColor({ id: 2, name: 'Bug' }, rules)).toBe('#d14343')
    })
})
