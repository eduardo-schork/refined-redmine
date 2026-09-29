import { useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import {
    ACCENT_PRESETS,
    DARK_PALETTES,
    DEFAULT_APPEARANCE,
    INTERFACE_SCALES,
    isHexColor,
    LIGHT_PALETTES,
    THEME_MODES,
    type AccentPreset,
    type Appearance,
    type DarkPalette,
    type LightPalette,
    type ThemeMode
} from '@domain/settings/appearance'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/fields'
import { Switch } from '../../atoms/Switch'
import { Field, ToggleField } from '../../molecules/Field'
import { SegmentedControl } from '../../molecules/SegmentedControl'
import { Card } from '../../molecules/surfaces'

interface PaletteSample {
    bg: string
    panel: string
    line: string
    text: string
}

// Same values as styles.css; used only to draw the small previews of each palette.
const LIGHT_SAMPLES: Record<LightPalette, PaletteSample> = {
    default: { bg: '#f6f7f9', panel: '#ffffff', line: '#e3e6eb', text: '#16181d' },
    warm: { bg: '#f7f4ee', panel: '#fffdf9', line: '#e6dfd2', text: '#221d16' }
}
const DARK_SAMPLES: Record<DarkPalette, PaletteSample> = {
    graphite: { bg: '#0b0d12', panel: '#14171e', line: '#262b36', text: '#e7e9ee' },
    midnight: { bg: '#0a1020', panel: '#111a2e', line: '#24304a', text: '#e4e9f5' },
    black: { bg: '#000000', panel: '#0c0c0e', line: '#232328', text: '#ececef' }
}

const THEME_ICONS: Record<ThemeMode, ReactNode> = {
    system: <Monitor size={14} />,
    light: <Sun size={14} />,
    dark: <Moon size={14} />
}

function useAppearance() {
    const settings = useSettings()
    const update = useUpdateSettings()
    const appearance = settings.appearance
    const change = (patch: Partial<Appearance>) => update.mutate({ appearance: { ...appearance, ...patch } })
    return { appearance, change, reset: () => update.mutate({ appearance: DEFAULT_APPEARANCE }) }
}

export function AppearanceSection() {
    const { t } = useI18n()
    const { appearance, change, reset } = useAppearance()
    const scaleOptions = INTERFACE_SCALES.map((scale) => ({ value: String(scale), label: `${scale}%` }))

    return (
        <Card
            title={t('appearance.title')}
            description={t('appearance.hint')}
            actions={<Button onClick={reset}>{t('appearance.reset')}</Button>}
        >
            <div className="flex flex-col gap-6">
                <Field label={t('appearance.theme')}>
                    <div className="grid grid-cols-3 gap-3">
                        {THEME_MODES.map((mode) => (
                            <ThemeCard
                                key={mode}
                                mode={mode}
                                appearance={appearance}
                                selected={appearance.theme === mode}
                                onSelect={() => change({ theme: mode })}
                            />
                        ))}
                    </div>
                </Field>

                <div className="grid grid-cols-2 gap-6">
                    <Field label={t('appearance.lightPalette')}>
                        <div className="flex gap-2">
                            {LIGHT_PALETTES.map((palette) => (
                                <PaletteChip
                                    key={palette}
                                    label={t(`appearance.palette.${palette}`)}
                                    sample={LIGHT_SAMPLES[palette]}
                                    accent={appearance.accent}
                                    selected={appearance.lightPalette === palette}
                                    onSelect={() => change({ lightPalette: palette })}
                                />
                            ))}
                        </div>
                    </Field>
                    <Field label={t('appearance.darkPalette')}>
                        <div className="flex gap-2">
                            {DARK_PALETTES.map((palette) => (
                                <PaletteChip
                                    key={palette}
                                    label={t(`appearance.palette.${palette}`)}
                                    sample={DARK_SAMPLES[palette]}
                                    accent={appearance.accent}
                                    selected={appearance.darkPalette === palette}
                                    onSelect={() => change({ darkPalette: palette })}
                                />
                            ))}
                        </div>
                    </Field>
                </div>

                <AccentPicker
                    key={appearance.accent}
                    accent={appearance.accent}
                    onChange={(accent) => change({ accent })}
                />

                <div className="grid grid-cols-2 gap-6">
                    <Field label={t('appearance.scale')} hint={t('appearance.scaleHint')}>
                        <div className="w-fit">
                            <SegmentedControl
                                value={String(appearance.scale)}
                                options={scaleOptions}
                                onChange={(scale) => change({ scale: Number(scale) })}
                            />
                        </div>
                    </Field>
                    <ToggleField
                        checked={appearance.reduceMotion}
                        onChange={(reduceMotion) => change({ reduceMotion })}
                        label={t('appearance.reduceMotion')}
                        description={t('appearance.reduceMotionHint')}
                    />
                </div>

                <LivePreview />
            </div>
        </Card>
    )
}

/** Card of a theme mode with a miniature window; "system" shows half light, half dark. */
function ThemeCard({
    mode,
    appearance,
    selected,
    onSelect
}: {
    mode: ThemeMode
    appearance: Appearance
    selected: boolean
    onSelect: () => void
}) {
    const { t } = useI18n()
    const light = LIGHT_SAMPLES[appearance.lightPalette]
    const dark = DARK_SAMPLES[appearance.darkPalette]
    return (
        <button
            onClick={onSelect}
            className={cn(
                'flex cursor-default flex-col gap-2 rounded-xl border p-2 text-left',
                selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-muted/50'
            )}
        >
            <div className="flex h-20 overflow-hidden rounded-lg border border-line">
                {mode !== 'dark' && <MiniWindow sample={light} accent={appearance.accent} />}
                {mode !== 'light' && <MiniWindow sample={dark} accent={appearance.accent} />}
            </div>
            <span className="flex items-center gap-1.5 px-1 text-[13px]">
                {THEME_ICONS[mode]}
                {t(`appearance.mode.${mode}`)}
                {selected && <Check size={13} className="ml-auto text-accent" />}
            </span>
        </button>
    )
}

function MiniWindow({ sample, accent }: { sample: PaletteSample; accent: string }) {
    return (
        <div className="flex flex-1 gap-1 p-1.5" style={{ background: sample.bg }}>
            <div className="w-1/4 rounded" style={{ background: sample.panel, border: `1px solid ${sample.line}` }} />
            <div
                className="flex flex-1 flex-col gap-1 rounded p-1.5"
                style={{ background: sample.panel, border: `1px solid ${sample.line}` }}
            >
                <div className="h-1.5 w-3/4 rounded-full" style={{ background: sample.text, opacity: 0.7 }} />
                <div className="h-1.5 w-1/2 rounded-full" style={{ background: sample.text, opacity: 0.35 }} />
                <div className="mt-auto h-2.5 w-8 rounded" style={{ background: accent }} />
            </div>
        </div>
    )
}

function PaletteChip({
    label,
    sample,
    accent,
    selected,
    onSelect
}: {
    label: string
    sample: PaletteSample
    accent: string
    selected: boolean
    onSelect: () => void
}) {
    return (
        <button
            onClick={onSelect}
            className={cn(
                'flex cursor-default flex-col items-center gap-1 rounded-lg border p-1.5 text-xs',
                selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-muted/50'
            )}
        >
            <span
                className="flex h-9 w-14 items-end rounded-md p-1"
                style={{ background: sample.bg, border: `1px solid ${sample.line}` }}
            >
                <span className="h-4 flex-1 rounded-sm" style={{ background: sample.panel }} />
                <span className="ml-1 h-2 w-2 rounded-full" style={{ background: accent }} />
            </span>
            {label}
        </button>
    )
}

/** Presets plus any color: the native color picker or a typed hex value. */
function AccentPicker({ accent, onChange }: { accent: string; onChange: (accent: string) => void }) {
    const { t } = useI18n()
    const [typed, setTyped] = useState(accent)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const presets = Object.entries(ACCENT_PRESETS) as [AccentPreset, string][]
    const isCustom = !presets.some(([, hex]) => hex === accent)

    // The native picker fires on every mouse move; saving waits until the user stops dragging.
    const pickLater = (hex: string) => {
        setTyped(hex)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => onChange(hex), 250)
    }

    const commitTyped = (value: string) => {
        const hex = value.startsWith('#') ? value : `#${value}`
        if (isHexColor(hex)) onChange(hex.toLowerCase())
        else setTyped(accent)
    }

    return (
        <Field label={t('appearance.accent')} hint={t('appearance.accentHint')}>
            <div className="flex flex-wrap items-center gap-2">
                {presets.map(([preset, hex]) => (
                    <button
                        key={preset}
                        title={t(`appearance.accentPreset.${preset}`)}
                        onClick={() => onChange(hex)}
                        className="flex h-8 w-8 cursor-default items-center justify-center rounded-full"
                        style={{ background: hex }}
                    >
                        {accent === hex && <Check size={15} className="text-white" />}
                    </button>
                ))}
                <label
                    title={t('appearance.customColor')}
                    className={cn(
                        'relative flex h-8 w-8 cursor-default items-center justify-center overflow-hidden rounded-full border-2 border-dashed',
                        isCustom ? 'border-accent' : 'border-line'
                    )}
                    style={isCustom ? { background: accent } : undefined}
                >
                    <span className={cn('text-xs', isCustom ? 'text-on-accent' : 'text-muted')}>+</span>
                    <input
                        type="color"
                        className="absolute inset-0 opacity-0"
                        value={isHexColor(typed) ? typed : accent}
                        onChange={(event) => pickLater(event.target.value)}
                    />
                </label>
                <Input
                    className="ml-2 w-28 font-mono"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    onBlur={(event) => commitTyped(event.target.value.trim())}
                />
            </div>
        </Field>
    )
}

/** Real components with the current tokens, to see the result right away. */
function LivePreview() {
    const { t } = useI18n()
    const [checked, setChecked] = useState(true)
    return (
        <div>
            <h3 className="mb-2 text-xs font-medium text-muted">{t('appearance.preview')}</h3>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-bg p-4">
                <Button variant="primary">{t('common.save')}</Button>
                <Button>{t('common.cancel')}</Button>
                <Badge tone="accent">3</Badge>
                <Switch checked={checked} onChange={setChecked} label={t('appearance.preview')} />
                <span className="text-[13px] text-accent">{t('appearance.previewLink')}</span>
                <span className="rounded-md bg-accent-soft px-2 py-1 text-xs text-accent">
                    {t('appearance.previewSelected')}
                </span>
                <span className="text-xs text-ok">● {t('appearance.previewOk')}</span>
                <span className="text-xs text-warn">● {t('appearance.previewWarn')}</span>
                <span className="text-xs text-danger">● {t('appearance.previewDanger')}</span>
            </div>
        </div>
    )
}
