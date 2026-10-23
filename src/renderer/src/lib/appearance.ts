import { useEffect } from 'react'
import { darkThemeAccent, textOnAccent, type Appearance } from '@domain/settings/appearance'
import { resolveColors } from '@domain/settings/colors'
import { colorTokensCss } from './issue-colors'

const COLOR_STYLE_ID = 'color-tokens'

function colorStyleElement(): HTMLStyleElement {
    const existing = document.getElementById(COLOR_STYLE_ID)
    if (existing instanceof HTMLStyleElement) return existing
    const created = document.createElement('style')
    created.id = COLOR_STYLE_ID
    document.head.appendChild(created)
    return created
}

/** Applies palettes, accent, issue colors, interface size and motion preference to the document. */
export function useApplyAppearance(appearance: Appearance): void {
    useEffect(() => {
        const root = document.documentElement
        root.dataset.lightPalette = appearance.lightPalette
        root.dataset.darkPalette = appearance.darkPalette
        root.dataset.reduceMotion = String(appearance.reduceMotion)
        root.style.setProperty('--accent-base', appearance.accent)
        root.style.setProperty('--accent-text-light', textOnAccent(appearance.accent))
        root.style.setProperty('--accent-text-dark', textOnAccent(darkThemeAccent(appearance.accent)))
        root.style.zoom = String(appearance.scale / 100)
        const colors = resolveColors(appearance.colorPreset, appearance.colors)
        colorStyleElement().textContent = colorTokensCss(colors)
    }, [appearance])
}
