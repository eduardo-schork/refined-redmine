import { describe, expect, it } from 'vitest'
import { COLOR_KEYS, COLOR_PRESETS, presetColor, resolveColors, validColorOverrides } from './colors'
import { withAppearanceDefaults } from './appearance'

describe('color presets', () => {
    it('give every color a light and a dark hex value', () => {
        for (const preset of COLOR_PRESETS) {
            for (const key of COLOR_KEYS) {
                const color = presetColor(preset, key)
                expect(color.light).toMatch(/^#[0-9a-f]{6}$/)
                expect(color.dark).toMatch(/^#[0-9a-f]{6}$/)
            }
        }
    })
})

describe('resolveColors', () => {
    it('uses the preset where the user chose nothing', () => {
        const colors = resolveColors('vivid', {})
        expect(colors['pr-urgent']).toEqual(presetColor('vivid', 'pr-urgent'))
    })

    it('uses the user color on the light theme and a lighter mix of it on the dark theme', () => {
        const colors = resolveColors('default', { 'pr-urgent': '#000000' })
        expect(colors['pr-urgent']).toEqual({ light: '#000000', dark: '#383838' })
        expect(colors.danger).toEqual(presetColor('default', 'danger'))
    })
})

describe('validColorOverrides', () => {
    it('drops unknown keys and invalid colors', () => {
        const loaded = { 'pr-urgent': '#ABCDEF', ok: 'green', neon: '#123456', warn: 7 }
        expect(validColorOverrides(loaded)).toEqual({ 'pr-urgent': '#abcdef' })
        expect(validColorOverrides('nope')).toEqual({})
    })

    it('runs when the appearance is loaded', () => {
        const appearance = withAppearanceDefaults({ colorPreset: 'neon', colors: { ok: 'x' } } as never)
        expect(appearance.colorPreset).toBe('default')
        expect(appearance.colors).toEqual({})
    })
})
