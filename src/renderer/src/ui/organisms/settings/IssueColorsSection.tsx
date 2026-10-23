import { Check } from 'lucide-react'
import type { Issue, IssueStatus, Named } from '@domain/redmine/entities'
import { CARD_ACCENTS, STATUS_TONES, type IssueStyleRules } from '@domain/redmine/issue-style'
import { DEFAULT_APPEARANCE } from '@domain/settings/appearance'
import {
    COLOR_GROUPS,
    COLOR_PRESETS,
    presetColor,
    resolveColor,
    type ColorGroup,
    type ColorKey,
    type ColorOverrides,
    type ColorPreset
} from '@domain/settings/colors'
import { addDays, startOfDay, toLocalDate } from '@domain/shared/date'
import { useSaveSection, useSettings } from '@/hooks/session'
import { IssueStyleContext, useIssueStyle } from '@/lib/issue-style'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '../../atoms/Button'
import { ColorSwatch } from '../../molecules/ColorSwatch'
import { Field, ToggleField } from '../../molecules/Field'
import { IssueCard } from '../../molecules/IssueCard'
import { DueChip, PriorityChip, TrackerLabel } from '../../molecules/issue-chips'
import { SegmentedControl } from '../../molecules/SegmentedControl'
import { StatusTag } from '../../molecules/StatusTag'
import { Card } from '../../molecules/surfaces'

const GROUP_ORDER: ColorGroup[] = ['status', 'priority', 'due', 'semantic']

/** Preset, card stripe, live preview and every issue/message color. */
export function IssueColorsSection() {
    const { t } = useI18n()
    const appearance = useSettings().appearance
    const save = useSaveSection('appearance')
    const isCustomized =
        appearance.colorPreset !== DEFAULT_APPEARANCE.colorPreset || Object.keys(appearance.colors).length > 0
    const restoreAll = () => save(() => ({ colorPreset: DEFAULT_APPEARANCE.colorPreset, colors: {} }))
    const actions = isCustomized && <Button onClick={restoreAll}>{t('issueColors.restoreAll')}</Button>

    return (
        <Card title={t('issueColors.title')} description={t('issueColors.hint')} actions={actions}>
            <div className="flex flex-col gap-6">
                <PresetPicker
                    selected={appearance.colorPreset}
                    onSelect={(colorPreset) => save(() => ({ colorPreset }))}
                />
                <CardAccentFields />
                <IssueColorsPreview />
                {GROUP_ORDER.map((group) => (
                    <ColorGroupSwatches
                        key={group}
                        group={group}
                        preset={appearance.colorPreset}
                        overrides={appearance.colors}
                    />
                ))}
            </div>
        </Card>
    )
}

const SAMPLE_KEYS: ColorKey[] = ['st-progress', 'st-review', 'st-testing', 'st-done', 'pr-high', 'pr-urgent']
// Panel colors of the default palettes (styles.css), only to draw the preset samples.
const LIGHT_PANEL = '#ffffff'
const DARK_PANEL = '#14171e'

function PresetPicker({ selected, onSelect }: { selected: ColorPreset; onSelect: (preset: ColorPreset) => void }) {
    const { t } = useI18n()
    return (
        <Field label={t('issueColors.preset')} hint={t('issueColors.presetHint')}>
            <div className="grid grid-cols-4 gap-3">
                {COLOR_PRESETS.map((preset) => (
                    <PresetCard
                        key={preset}
                        preset={preset}
                        selected={preset === selected}
                        onSelect={() => onSelect(preset)}
                    />
                ))}
            </div>
        </Field>
    )
}

function PresetCard({ preset, selected, onSelect }: { preset: ColorPreset; selected: boolean; onSelect: () => void }) {
    const { t } = useI18n()
    return (
        <button
            onClick={onSelect}
            className={cn(
                'flex cursor-default flex-col gap-2 rounded-xl border p-2 text-left',
                selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-muted/50'
            )}
        >
            <div className="overflow-hidden rounded-lg border border-line">
                <SampleDots preset={preset} theme="light" background={LIGHT_PANEL} />
                <SampleDots preset={preset} theme="dark" background={DARK_PANEL} />
            </div>
            <span className="flex items-center gap-1.5 px-1 text-sm">
                {t(`issueColors.presets.${preset}`)}
                {selected && <Check size={13} className="ml-auto text-accent" />}
            </span>
        </button>
    )
}

function SampleDots({
    preset,
    theme,
    background
}: {
    preset: ColorPreset
    theme: 'light' | 'dark'
    background: string
}) {
    return (
        <div className="flex justify-between px-2 py-1.5" style={{ background }}>
            {SAMPLE_KEYS.map((key) => (
                <span
                    key={key}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: presetColor(preset, key)[theme] }}
                />
            ))}
        </div>
    )
}

function CardAccentFields() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveSection('issueStyle')
    const options = CARD_ACCENTS.map((accent) => ({ value: accent, label: t(`issueColors.cardAccent.${accent}`) }))
    return (
        <div className="grid grid-cols-2 gap-6">
            <Field label={t('issueColors.cardAccentLabel')} hint={t('issueColors.cardAccentHint')}>
                <div className="w-fit">
                    <SegmentedControl
                        value={rules.cardAccent}
                        options={options}
                        onChange={(cardAccent) => save(() => ({ cardAccent }))}
                    />
                </div>
            </Field>
            <ToggleField
                checked={rules.cardTint}
                onChange={(cardTint) => save(() => ({ cardTint }))}
                label={t('issueColors.cardTint')}
                description={t('issueColors.cardTintHint')}
            />
        </div>
    )
}

function ColorGroupSwatches({
    group,
    preset,
    overrides
}: {
    group: ColorGroup
    preset: ColorPreset
    overrides: ColorOverrides
}) {
    const { t } = useI18n()
    const save = useSaveSection('appearance')
    const setColor = (key: ColorKey, hex: string) => save((current) => ({ colors: { ...current.colors, [key]: hex } }))
    const resetColor = (key: ColorKey) =>
        save((current) => {
            const colors = { ...current.colors }
            delete colors[key]
            return { colors }
        })

    return (
        <div>
            <h3 className="mb-1 text-sm font-semibold">{t(`issueColors.group.${group}`)}</h3>
            <div className="grid grid-cols-2 gap-x-6">
                {COLOR_GROUPS[group].map((key) => {
                    const value = resolveColor(preset, overrides, key).light
                    return (
                        <ColorSwatch
                            key={`${key}-${value}`}
                            label={t(`issueColors.color.${key}`)}
                            value={value}
                            changed={key in overrides}
                            onChange={(hex) => setColor(key, hex)}
                            onReset={() => resetColor(key)}
                        />
                    )
                })}
            </div>
        </div>
    )
}

// Fictional statuses and priorities with negative ids, so they never match the user's choices for real ones.
const SAMPLE_PRIORITY_IDS = { urgent: -1, high: -2, low: -3 } as const

function sampleRules(rules: IssueStyleRules): IssueStyleRules {
    const statusTones = Object.fromEntries(STATUS_TONES.map((tone, index) => [-1 - index, tone]))
    const priorityLevels: IssueStyleRules['priorityLevels'] = {
        [SAMPLE_PRIORITY_IDS.urgent]: 'urgent',
        [SAMPLE_PRIORITY_IDS.high]: 'high',
        [SAMPLE_PRIORITY_IDS.low]: 'low'
    }
    return { ...rules, statusTones, priorityLevels }
}

function useSamples() {
    const { t } = useI18n()
    const now = new Date()
    const dueIn = (days: number) => toLocalDate(addDays(startOfDay(now), days))
    const statuses: IssueStatus[] = STATUS_TONES.map((tone, index) => ({
        id: -1 - index,
        name: t(`settings.issueStyle.tones.${tone}`),
        is_closed: tone === 'done' || tone === 'rejected'
    }))
    const priority = (level: keyof typeof SAMPLE_PRIORITY_IDS): Named => ({
        id: SAMPLE_PRIORITY_IDS[level],
        name: t(`issueColors.sample.priority.${level}`)
    })
    const trackers: Named[] = [
        { id: -1, name: t('issueColors.sample.tracker.bug') },
        { id: -2, name: t('issueColors.sample.tracker.feature') },
        { id: -3, name: t('issueColors.sample.tracker.support') }
    ]
    const base = {
        project: { id: -1, name: t('issueColors.sample.project') },
        author: { id: -1, name: t('issueColors.sample.person') },
        assigned_to: { id: -1, name: t('issueColors.sample.person') },
        created_on: now.toISOString(),
        updated_on: now.toISOString(),
        done_ratio: 0
    }
    const issues: Issue[] = [
        {
            ...base,
            id: 1201,
            tracker: trackers[0],
            status: statuses[1],
            priority: priority('urgent'),
            subject: t('issueColors.sample.subject.first'),
            due_date: dueIn(-2)
        },
        {
            ...base,
            id: 1202,
            tracker: trackers[1],
            status: statuses[2],
            priority: priority('high'),
            subject: t('issueColors.sample.subject.second'),
            due_date: dueIn(1),
            done_ratio: 60
        },
        {
            ...base,
            id: 1203,
            tracker: trackers[2],
            status: statuses[3],
            priority: priority('low'),
            subject: t('issueColors.sample.subject.third'),
            due_date: dueIn(0)
        }
    ]
    return { now, statuses, trackers, issues }
}

/** Real cards, tags and chips with fictional data, drawn with the current colors. */
function IssueColorsPreview() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const { now, statuses, trackers, issues } = useSamples()
    const cardOptions = { showStatus: true, staleDays: 30 }
    return (
        <IssueStyleContext.Provider value={sampleRules(rules)}>
            <div>
                <h3 className="mb-2 text-xs font-medium text-muted">{t('appearance.preview')}</h3>
                <div className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {statuses.map((status) => (
                            <StatusTag key={status.id} status={status} />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {issues.map((issue) => (
                            <PriorityChip key={issue.id} priority={issue.priority} />
                        ))}
                        {issues.map((issue) => (
                            <DueChip key={issue.id} issue={issue} now={now} />
                        ))}
                        {trackers.map((tracker) => (
                            <TrackerLabel key={tracker.id} tracker={tracker} className="px-1 text-xs" />
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {issues.map((issue) => (
                            <IssueCard key={issue.id} issue={issue} options={cardOptions} />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                        <span className="text-ok">● {t('appearance.previewOk')}</span>
                        <span className="text-warn">● {t('appearance.previewWarn')}</span>
                        <span className="text-danger">● {t('appearance.previewDanger')}</span>
                    </div>
                </div>
            </div>
        </IssueStyleContext.Provider>
    )
}
