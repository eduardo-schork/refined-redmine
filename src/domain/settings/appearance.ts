import { COLOR_PRESETS, isHexColor, validColorOverrides, type ColorOverrides, type ColorPreset } from './colors'

export { darkThemeAccent, isHexColor, textOnAccent } from './colors'

export type ThemeMode = 'system' | 'light' | 'dark'
export type LightPalette = 'default' | 'warm'
export type DarkPalette = 'graphite' | 'midnight' | 'black'

/** Visual preferences: theme, palette of each theme, accent color and interface size. */
export interface Appearance {
    theme: ThemeMode
    lightPalette: LightPalette
    darkPalette: DarkPalette
    /** Hex color (#rrggbb) used for buttons, links, selection and highlights. */
    accent: string
    /** Interface size in percent. */
    scale: number
    reduceMotion: boolean
    /** Base colors of issues and app messages. */
    colorPreset: ColorPreset
    /** Colors the user replaced on top of the preset (#rrggbb). */
    colors: ColorOverrides
}

export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']
export const LIGHT_PALETTES: LightPalette[] = ['default', 'warm']
export const DARK_PALETTES: DarkPalette[] = ['graphite', 'midnight', 'black']
export const INTERFACE_SCALES = [90, 100, 110, 125]

export const ACCENT_PRESETS = {
    refined: '#0085ff',
    redmine: '#c43a3a',
    blue: '#2563eb',
    teal: '#0d9488',
    green: '#16a34a',
    orange: '#ea580c',
    pink: '#db2777',
    purple: '#7c3aed',
    graphite: '#475569'
} as const

export type AccentPreset = keyof typeof ACCENT_PRESETS

export const DEFAULT_APPEARANCE: Appearance = {
    theme: 'system',
    lightPalette: 'default',
    darkPalette: 'graphite',
    accent: ACCENT_PRESETS.refined,
    scale: 100,
    reduceMotion: false,
    colorPreset: 'default',
    colors: {}
}

function pickFrom<T>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback
}

/** Invalid or unknown values from the file fall back to the defaults, so a bad edit never breaks the UI. */
export function withAppearanceDefaults(loaded: Partial<Appearance> = {}): Appearance {
    const defaults = DEFAULT_APPEARANCE
    const accent = typeof loaded.accent === 'string' && isHexColor(loaded.accent) ? loaded.accent : defaults.accent
    return {
        theme: pickFrom(loaded.theme, THEME_MODES, defaults.theme),
        lightPalette: pickFrom(loaded.lightPalette, LIGHT_PALETTES, defaults.lightPalette),
        darkPalette: pickFrom(loaded.darkPalette, DARK_PALETTES, defaults.darkPalette),
        accent: accent.toLowerCase(),
        scale: pickFrom(loaded.scale, INTERFACE_SCALES, defaults.scale),
        reduceMotion: Boolean(loaded.reduceMotion),
        colorPreset: pickFrom(loaded.colorPreset, COLOR_PRESETS, defaults.colorPreset),
        colors: validColorOverrides(loaded.colors)
    }
}
