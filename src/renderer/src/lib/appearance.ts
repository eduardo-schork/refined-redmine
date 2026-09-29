import { useEffect } from 'react'
import { darkThemeAccent, textOnAccent, type Appearance } from '@domain/settings/appearance'

/** Applies palettes, accent, interface size and motion preference to the document. */
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
    }, [appearance])
}
