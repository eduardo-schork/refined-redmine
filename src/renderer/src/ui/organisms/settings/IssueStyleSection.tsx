import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import type { IssueStatus, Named } from '@domain/redmine/entities'
import { priorityLevel, type PriorityLevel } from '@domain/redmine/issue-signals'
import {
    DEFAULT_ISSUE_STYLE,
    MAX_DUE_SOON_DAYS,
    PRIORITY_LEVELS,
    STATUS_TONES,
    type IssueStyleRules
} from '@domain/redmine/issue-style'
import { statusTone, type StatusTone } from '@domain/redmine/status-tone'
import { trackerColor } from '@domain/redmine/tracker-color'
import { usePriorities, useStatuses, useTrackers } from '@/hooks/reference'
import { useSaveSection } from '@/hooks/session'
import { useIssueStyle } from '@/lib/issue-style'
import { useI18n } from '@/lib/i18n'
import { STATUS_BACKGROUND } from '@/lib/status-colors'
import { cn } from '@/lib/cn'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/fields'
import { IconButton } from '../../atoms/IconButton'
import { ColorSwatch, CustomColorButton } from '../../molecules/ColorSwatch'
import { Field } from '../../molecules/Field'
import { PriorityChip } from '../../molecules/issue-chips'
import { StatusTag } from '../../molecules/StatusTag'
import { Card } from '../../molecules/surfaces'

/** Removes an id from a choice map, or sets it; "automatic" means the id is not in the map. */
function withChoice<T>(choices: Record<number, T>, id: number, value: T | undefined): Record<number, T> {
    const next = { ...choices }
    delete next[id]
    if (value !== undefined) next[id] = value
    return next
}

function hasChoices(rules: IssueStyleRules): boolean {
    const choiceMaps = [
        rules.statusTones,
        rules.statusColors,
        rules.priorityLevels,
        rules.priorityColors,
        rules.trackerColors
    ]
    return choiceMaps.some((choices) => Object.keys(choices).length > 0)
}

/** Status families, priority levels, tracker colors and the "due soon" window. */
export function IssueStyleSection() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveSection('issueStyle')
    const reset = () =>
        save(() => ({ statusTones: {}, statusColors: {}, priorityLevels: {}, priorityColors: {}, trackerColors: {} }))
    const actions = hasChoices(rules) && <Button onClick={reset}>{t('settings.issueStyle.reset')}</Button>

    return (
        <Card title={t('settings.issueStyle.title')} description={t('settings.issueStyle.hint')} actions={actions}>
            <div className="flex flex-col gap-6">
                <StatusColors />
                <PriorityLevels />
                <TrackerColors />
                <DueSoonField />
            </div>
        </Card>
    )
}

function ChoiceRow({ preview, children }: { preview: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-center gap-4 border-t border-line py-2 first:border-t-0">
            <div className="min-w-0 flex-1">{preview}</div>
            <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
    )
}

/** Small "back to automatic" button, kept in place (invisible) when there is nothing to undo. */
function ResetChoice({ visible, label, onClick }: { visible: boolean; label: string; onClick: () => void }) {
    return (
        <IconButton
            size="sm"
            label={label}
            icon={<RotateCcw />}
            onClick={onClick}
            className={visible ? undefined : 'invisible'}
        />
    )
}

const SELECTED_RING = 'ring-2 ring-fg/70 ring-offset-2 ring-offset-panel'

function ToneDot({ tone, selected, onSelect }: { tone: StatusTone; selected: boolean; onSelect: () => void }) {
    const { t } = useI18n()
    return (
        <button
            type="button"
            title={t(`settings.issueStyle.tones.${tone}`)}
            aria-label={t(`settings.issueStyle.tones.${tone}`)}
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
                'h-6 w-6 shrink-0 cursor-default rounded-full',
                STATUS_BACKGROUND[tone],
                selected && SELECTED_RING
            )}
        />
    )
}

function StatusColors() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveSection('issueStyle')
    const statuses = useStatuses().data ?? []

    const chooseTone = (status: IssueStatus, tone: StatusTone) => {
        const keepAutomatic = tone === statusTone(status)
        save((current) => ({
            statusTones: withChoice(current.statusTones, status.id, keepAutomatic ? undefined : tone),
            statusColors: withChoice(current.statusColors, status.id, undefined)
        }))
    }
    const chooseColor = (status: IssueStatus, hex: string) =>
        save((current) => ({ statusColors: withChoice(current.statusColors, status.id, hex) }))
    const reset = (status: IssueStatus) =>
        save((current) => ({
            statusTones: withChoice(current.statusTones, status.id, undefined),
            statusColors: withChoice(current.statusColors, status.id, undefined)
        }))

    return (
        <div>
            <h3 className="mb-1 text-sm font-semibold">{t('settings.issueStyle.statuses')}</h3>
            <p className="mb-2 text-xs text-muted">{t('settings.issueStyle.statusesHint')}</p>
            {statuses.map((status) => {
                const tone = statusTone(status, rules)
                const customColor = rules.statusColors[status.id]
                const changed = status.id in rules.statusTones || customColor !== undefined
                const automatic = t(`settings.issueStyle.tones.${statusTone(status)}`)
                return (
                    <ChoiceRow key={status.id} preview={<StatusTag status={status} />}>
                        {STATUS_TONES.map((option) => (
                            <ToneDot
                                key={option}
                                tone={option}
                                selected={!customColor && option === tone}
                                onSelect={() => chooseTone(status, option)}
                            />
                        ))}
                        <CustomColorButton
                            key={customColor ?? 'none'}
                            label={t('settings.issueStyle.customColor')}
                            value={customColor}
                            fallback="#2f6fdb"
                            onChange={(hex) => chooseColor(status, hex)}
                        />
                        <ResetChoice
                            visible={changed}
                            label={t('settings.issueStyle.resetOne', { value: automatic })}
                            onClick={() => reset(status)}
                        />
                    </ChoiceRow>
                )
            })}
        </div>
    )
}

const LEVEL_PILL: Record<PriorityLevel, string> = {
    urgent: 'bg-pr-urgent/15 text-pr-urgent',
    high: 'bg-pr-high/15 text-pr-high',
    normal: 'bg-panel-2 text-fg/80',
    low: 'bg-pr-low/15 text-pr-low'
}

function LevelPill({ level, selected, onSelect }: { level: PriorityLevel; selected: boolean; onSelect: () => void }) {
    const { t } = useI18n()
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
                'cursor-default rounded-md px-2 py-1 text-xs font-medium',
                LEVEL_PILL[level],
                selected ? 'ring-2 ring-current' : 'opacity-60 hover:opacity-100'
            )}
        >
            {t(`settings.issueStyle.levels.${level}`)}
        </button>
    )
}

function PriorityLevels() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveSection('issueStyle')
    const priorities = usePriorities().data ?? []

    const chooseLevel = (priority: Named, level: PriorityLevel) => {
        const keepAutomatic = level === priorityLevel(priority)
        save((current) => ({
            priorityLevels: withChoice(current.priorityLevels, priority.id, keepAutomatic ? undefined : level)
        }))
    }
    const chooseColor = (priority: Named, hex: string) =>
        save((current) => ({ priorityColors: withChoice(current.priorityColors, priority.id, hex) }))
    const reset = (priority: Named) =>
        save((current) => ({
            priorityLevels: withChoice(current.priorityLevels, priority.id, undefined),
            priorityColors: withChoice(current.priorityColors, priority.id, undefined)
        }))

    return (
        <div>
            <h3 className="mb-1 text-sm font-semibold">{t('settings.issueStyle.priorities')}</h3>
            <p className="mb-2 text-xs text-muted">{t('settings.issueStyle.prioritiesHint')}</p>
            {priorities.map((priority) => {
                const level = priorityLevel(priority, rules)
                const customColor = rules.priorityColors[priority.id]
                const changed = priority.id in rules.priorityLevels || customColor !== undefined
                const automatic = t(`settings.issueStyle.levels.${priorityLevel(priority)}`)
                const preview = (
                    <span className="flex items-center gap-2 text-sm">
                        {priority.name}
                        <PriorityChip priority={priority} />
                    </span>
                )
                return (
                    <ChoiceRow key={priority.id} preview={preview}>
                        {PRIORITY_LEVELS.map((option) => (
                            <LevelPill
                                key={option}
                                level={option}
                                selected={option === level}
                                onSelect={() => chooseLevel(priority, option)}
                            />
                        ))}
                        <CustomColorButton
                            key={customColor ?? 'none'}
                            label={t('settings.issueStyle.customColor')}
                            value={customColor}
                            fallback="#d14343"
                            onChange={(hex) => chooseColor(priority, hex)}
                        />
                        <ResetChoice
                            visible={changed}
                            label={t('settings.issueStyle.resetOne', { value: automatic })}
                            onClick={() => reset(priority)}
                        />
                    </ChoiceRow>
                )
            })}
        </div>
    )
}

function TrackerColors() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveSection('issueStyle')
    const trackers = useTrackers().data ?? []

    const choose = (tracker: Named, hex: string | undefined) =>
        save((current) => ({ trackerColors: withChoice(current.trackerColors, tracker.id, hex) }))

    return (
        <div>
            <h3 className="mb-1 text-sm font-semibold">{t('settings.issueStyle.trackers')}</h3>
            <p className="mb-2 text-xs text-muted">{t('settings.issueStyle.trackersHint')}</p>
            <div className="grid grid-cols-2 gap-x-6">
                {trackers.map((tracker) => {
                    const color = trackerColor(tracker, rules)
                    return (
                        <ColorSwatch
                            key={`${tracker.id}-${color}`}
                            label={tracker.name}
                            value={color}
                            changed={tracker.id in rules.trackerColors}
                            onChange={(hex) => choose(tracker, hex)}
                            onReset={() => choose(tracker, undefined)}
                        />
                    )
                })}
            </div>
        </div>
    )
}

function DueSoonField() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveSection('issueStyle')
    const saveDays = (value: string) => {
        const days = Math.min(MAX_DUE_SOON_DAYS, Math.max(0, Math.round(Number(value))))
        const valid = Number.isFinite(days) ? days : DEFAULT_ISSUE_STYLE.dueSoonDays
        if (valid !== rules.dueSoonDays) save(() => ({ dueSoonDays: valid }))
    }
    return (
        <Field label={t('settings.issueStyle.dueSoon')} hint={t('settings.issueStyle.dueSoonHint')}>
            <Input
                key={rules.dueSoonDays}
                type="number"
                min={0}
                max={MAX_DUE_SOON_DAYS}
                className="w-32"
                defaultValue={rules.dueSoonDays}
                onBlur={(event) => saveDays(event.target.value)}
            />
        </Field>
    )
}
