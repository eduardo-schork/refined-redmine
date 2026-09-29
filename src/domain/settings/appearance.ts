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
}

export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']
export const LIGHT_PALETTES: LightPalette[] = ['default', 'warm']
export const DARK_PALETTES: DarkPalette[] = ['graphite', 'midnight', 'black']
export const INTERFACE_SCALES = [90, 100, 110, 125]

export const ACCENT_PRESETS = {
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
    accent: ACCENT_PRESETS.redmine,
    scale: 100,
    reduceMotion: false
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const isHexColor = (value: string) => HEX_COLOR.test(value)

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
        reduceMotion: Boolean(loaded.reduceMotion)
    }
}

function relativeLuminance(hex: string): number {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    const linear = channels.map((channel) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** Same mix the dark theme applies in CSS (78% accent + 22% white). */
export function darkThemeAccent(accent: string): string {
    const DARK_MIX = 0.78
    const channels = [1, 3, 5].map((start) => parseInt(accent.slice(start, start + 2), 16))
    const mixed = channels.map((channel) => Math.round(channel * DARK_MIX + 255 * (1 - DARK_MIX)))
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Text color on top of the accent: black on light accents (e.g. yellow), white on the others (WCAG luminance). */
export function textOnAccent(accent: string): '#000000' | '#ffffff' {
    const luminance = relativeLuminance(accent)
    const contrastWithWhite = 1.05 / (luminance + 0.05)
    const contrastWithBlack = (luminance + 0.05) / 0.05
    return contrastWithBlack > contrastWithWhite ? '#000000' : '#ffffff'
}
