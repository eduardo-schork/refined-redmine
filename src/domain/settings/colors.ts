/**
 * Colors of issues (status families, priority levels, due dates) and of the app messages (ok, warning, error).
 * A preset gives every color a light and a dark value; the user can replace any of them with one hex color, whose
 * dark value is derived the same way as the accent.
 */
export const COLOR_GROUPS = {
    status: ['st-new', 'st-progress', 'st-review', 'st-testing', 'st-blocked', 'st-done', 'st-rejected'],
    priority: ['pr-urgent', 'pr-high', 'pr-low'],
    due: ['due-overdue', 'due-today', 'due-soon'],
    semantic: ['ok', 'warn', 'danger']
} as const

export type ColorGroup = keyof typeof COLOR_GROUPS
/** Also the name of the CSS custom property (--st-new, --pr-urgent…). */
export type ColorKey = (typeof COLOR_GROUPS)[ColorGroup][number]
export type ColorOverrides = Partial<Record<ColorKey, string>>

export const COLOR_KEYS: ColorKey[] = Object.values(COLOR_GROUPS).flat()

export type ColorPreset = 'default' | 'vivid' | 'soft' | 'colorblind'
export const COLOR_PRESETS: ColorPreset[] = ['default', 'vivid', 'soft', 'colorblind']

export interface ThemeColor {
    light: string
    dark: string
}

type PresetColors = Record<ColorKey, [light: string, dark: string]>

const DEFAULT_COLORS: PresetColors = {
    'st-new': ['#7b8494', '#8f98a8'],
    'st-progress': ['#2f6fdb', '#5b9bff'],
    'st-review': ['#8b5cf6', '#a78bfa'],
    'st-testing': ['#0d9488', '#2dd4bf'],
    'st-blocked': ['#c27c0e', '#e8a93a'],
    'st-done': ['#1f9d55', '#3ccf7f'],
    'st-rejected': ['#a3a8b2', '#5f6573'],
    'pr-urgent': ['#d14343', '#f06a6a'],
    'pr-high': ['#c27c0e', '#e8a93a'],
    'pr-low': ['#5d6573', '#9ba3b3'],
    'due-overdue': ['#d14343', '#f06a6a'],
    'due-today': ['#d14343', '#f06a6a'],
    'due-soon': ['#c27c0e', '#e8a93a'],
    ok: ['#1f9d55', '#3ccf7f'],
    warn: ['#c27c0e', '#e8a93a'],
    danger: ['#d14343', '#f06a6a']
}

const VIVID_COLORS: PresetColors = {
    'st-new': ['#64748b', '#94a3b8'],
    'st-progress': ['#2563eb', '#60a5fa'],
    'st-review': ['#9333ea', '#c084fc'],
    'st-testing': ['#0891b2', '#22d3ee'],
    'st-blocked': ['#ea580c', '#fb923c'],
    'st-done': ['#16a34a', '#4ade80'],
    'st-rejected': ['#94a3b8', '#64748b'],
    'pr-urgent': ['#dc2626', '#f87171'],
    'pr-high': ['#ea580c', '#fb923c'],
    'pr-low': ['#0284c7', '#38bdf8'],
    'due-overdue': ['#dc2626', '#f87171'],
    'due-today': ['#e11d48', '#fb7185'],
    'due-soon': ['#d97706', '#fbbf24'],
    ok: ['#16a34a', '#4ade80'],
    warn: ['#d97706', '#fbbf24'],
    danger: ['#dc2626', '#f87171']
}

const SOFT_COLORS: PresetColors = {
    'st-new': ['#868d99', '#9aa0ab'],
    'st-progress': ['#5b7fbf', '#8aa8dc'],
    'st-review': ['#8f7bbf', '#b3a3dc'],
    'st-testing': ['#4c9a92', '#7cc0b8'],
    'st-blocked': ['#b08445', '#d9b07a'],
    'st-done': ['#5a9a6e', '#86c29a'],
    'st-rejected': ['#b0b4bb', '#6b707a'],
    'pr-urgent': ['#c06060', '#e08c8c'],
    'pr-high': ['#b08445', '#d9b07a'],
    'pr-low': ['#868d99', '#9aa0ab'],
    'due-overdue': ['#c06060', '#e08c8c'],
    'due-today': ['#c06060', '#e08c8c'],
    'due-soon': ['#b08445', '#d9b07a'],
    ok: ['#5a9a6e', '#86c29a'],
    warn: ['#b08445', '#d9b07a'],
    danger: ['#c06060', '#e08c8c']
}

// Okabe–Ito palette: blue/orange/vermillion/bluish green stay apart for the common kinds of color blindness. Some
// colors are darkened on the light theme so text keeps its contrast.
const COLORBLIND_COLORS: PresetColors = {
    'st-new': ['#6e7681', '#9aa1ab'],
    'st-progress': ['#0072b2', '#56b4e9'],
    'st-review': ['#b8558f', '#cc79a7'],
    'st-testing': ['#b07c00', '#e69f00'],
    'st-blocked': ['#d55e00', '#ef7d33'],
    'st-done': ['#009e73', '#2fc79a'],
    'st-rejected': ['#9a9a9a', '#6b6b6b'],
    'pr-urgent': ['#d55e00', '#ef7d33'],
    'pr-high': ['#b07c00', '#e69f00'],
    'pr-low': ['#2f8ac0', '#8fc9ef'],
    'due-overdue': ['#d55e00', '#ef7d33'],
    'due-today': ['#d55e00', '#ef7d33'],
    'due-soon': ['#b07c00', '#f0e442'],
    ok: ['#009e73', '#2fc79a'],
    warn: ['#b07c00', '#e69f00'],
    danger: ['#d55e00', '#ef7d33']
}

const PRESET_COLORS: Record<ColorPreset, PresetColors> = {
    default: DEFAULT_COLORS,
    vivid: VIVID_COLORS,
    soft: SOFT_COLORS,
    colorblind: COLORBLIND_COLORS
}

export function presetColor(preset: ColorPreset, key: ColorKey): ThemeColor {
    const [light, dark] = PRESET_COLORS[preset][key]
    return { light, dark }
}

/** The user's color wins over the preset; on the dark theme it is lightened like the accent. */
export function resolveColor(preset: ColorPreset, overrides: ColorOverrides, key: ColorKey): ThemeColor {
    const override = overrides[key]
    if (!override) return presetColor(preset, key)
    return { light: override, dark: darkThemeAccent(override) }
}

export function resolveColors(preset: ColorPreset, overrides: ColorOverrides): Record<ColorKey, ThemeColor> {
    const entries = COLOR_KEYS.map((key) => [key, resolveColor(preset, overrides, key)])
    return Object.fromEntries(entries) as Record<ColorKey, ThemeColor>
}

/** Unknown keys and values that are not #rrggbb are dropped. */
export function validColorOverrides(loaded: unknown): ColorOverrides {
    if (!loaded || typeof loaded !== 'object') return {}
    const isValid = ([key, value]: [string, unknown]) =>
        COLOR_KEYS.includes(key as ColorKey) && typeof value === 'string' && isHexColor(value)
    const entries = Object.entries(loaded).filter(isValid)
    return Object.fromEntries(entries.map(([key, value]) => [key, (value as string).toLowerCase()]))
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const isHexColor = (value: string) => HEX_COLOR.test(value)

function relativeLuminance(hex: string): number {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    const linear = channels.map((channel) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** Same mix the dark theme applies in CSS to the accent (78% color + 22% white). */
export function darkThemeAccent(color: string): string {
    const DARK_MIX = 0.78
    const channels = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16))
    const mixed = channels.map((channel) => Math.round(channel * DARK_MIX + 255 * (1 - DARK_MIX)))
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Text color on top of a color: black on light colors (e.g. yellow), white on the others (WCAG luminance). */
export function textOnAccent(color: string): '#000000' | '#ffffff' {
    const luminance = relativeLuminance(color)
    const contrastWithWhite = 1.05 / (luminance + 0.05)
    const contrastWithBlack = (luminance + 0.05) / 0.05
    return contrastWithBlack > contrastWithWhite ? '#000000' : '#ffffff'
}
