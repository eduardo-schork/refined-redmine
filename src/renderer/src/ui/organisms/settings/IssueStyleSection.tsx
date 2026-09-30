import { useEffect, useRef, type ReactNode } from 'react'
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
import { usePriorities, useStatuses } from '@/hooks/reference'
import { useUpdateSettings } from '@/hooks/session'
import { useIssueStyle } from '@/lib/issue-style'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { Input, Select } from '../../atoms/fields'
import { Field } from '../../molecules/Field'
import { PriorityChip } from '../../molecules/issue-chips'
import { StatusTag } from '../../molecules/StatusTag'
import { Card } from '../../molecules/surfaces'

const AUTOMATIC = ''

/** Removes an id from a choice map, or sets it; "automatic" means the id is not in the map. */
function withChoice<T>(choices: Record<number, T>, id: number, value: T | undefined): Record<number, T> {
    const next = { ...choices }
    delete next[id]
    if (value !== undefined) next[id] = value
    return next
}

type StyleChange = (current: IssueStyleRules) => Partial<IssueStyleRules>

/**
 * Each change starts from the latest value, including changes still being saved: two quick changes in a row
 * would otherwise both start from the same old value and the second would undo the first.
 */
function useSaveIssueStyle() {
    const rules = useIssueStyle()
    const update = useUpdateSettings()
    const latest = useRef(rules)
    useEffect(() => {
        latest.current = rules
    }, [rules])
    return (change: StyleChange) => {
        const next = { ...latest.current, ...change(latest.current) }
        latest.current = next
        update.mutate({ issueStyle: next })
    }
}

/** Status colors, priority levels and the "due soon" window. */
export function IssueStyleSection() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveIssueStyle()
    const hasChoices = Object.keys(rules.statusTones).length > 0 || Object.keys(rules.priorityLevels).length > 0
    const reset = () => save(() => ({ statusTones: {}, priorityLevels: {} }))
    const actions = hasChoices && <Button onClick={reset}>{t('settings.issueStyle.reset')}</Button>

    return (
        <Card title={t('settings.issueStyle.title')} description={t('settings.issueStyle.hint')} actions={actions}>
            <div className="flex flex-col gap-6">
                <StatusColors />
                <PriorityLevels />
                <DueSoonField />
            </div>
        </Card>
    )
}

function ChoiceRow({ preview, children }: { preview: ReactNode; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_19rem] items-center gap-4 border-t border-line py-2 first:border-t-0">
            <div className="min-w-0">{preview}</div>
            {children}
        </div>
    )
}

function StatusColors() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveIssueStyle()
    const statuses = useStatuses().data ?? []

    const choose = (status: IssueStatus, value: string) => {
        const tone = value === AUTOMATIC ? undefined : (value as StatusTone)
        save((current) => ({ statusTones: withChoice(current.statusTones, status.id, tone) }))
    }

    return (
        <div>
            <h3 className="mb-2 text-sm font-semibold">{t('settings.issueStyle.statuses')}</h3>
            {statuses.map((status) => {
                const inferred = statusTone(status)
                return (
                    <ChoiceRow key={status.id} preview={<StatusTag status={status} />}>
                        <Select
                            value={rules.statusTones[status.id] ?? AUTOMATIC}
                            onChange={(event) => choose(status, event.target.value)}
                        >
                            <option value={AUTOMATIC}>
                                {t('settings.issueStyle.automatic', {
                                    value: t(`settings.issueStyle.tones.${inferred}`)
                                })}
                            </option>
                            {STATUS_TONES.map((tone) => (
                                <option key={tone} value={tone}>
                                    {t(`settings.issueStyle.tones.${tone}`)}
                                </option>
                            ))}
                        </Select>
                    </ChoiceRow>
                )
            })}
        </div>
    )
}

function PriorityLevels() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveIssueStyle()
    const priorities = usePriorities().data ?? []

    const choose = (priority: Named, value: string) => {
        const level = value === AUTOMATIC ? undefined : (value as PriorityLevel)
        save((current) => ({ priorityLevels: withChoice(current.priorityLevels, priority.id, level) }))
    }

    return (
        <div>
            <h3 className="mb-1 text-sm font-semibold">{t('settings.issueStyle.priorities')}</h3>
            <p className="mb-2 text-xs text-muted">{t('settings.issueStyle.prioritiesHint')}</p>
            {priorities.map((priority) => {
                const inferred = priorityLevel(priority)
                const preview = (
                    <span className="flex items-center gap-2 text-sm">
                        {priority.name}
                        <PriorityChip priority={priority} />
                    </span>
                )
                return (
                    <ChoiceRow key={priority.id} preview={preview}>
                        <Select
                            value={rules.priorityLevels[priority.id] ?? AUTOMATIC}
                            onChange={(event) => choose(priority, event.target.value)}
                        >
                            <option value={AUTOMATIC}>
                                {t('settings.issueStyle.automatic', {
                                    value: t(`settings.issueStyle.levels.${inferred}`)
                                })}
                            </option>
                            {PRIORITY_LEVELS.map((level) => (
                                <option key={level} value={level}>
                                    {t(`settings.issueStyle.levels.${level}`)}
                                </option>
                            ))}
                        </Select>
                    </ChoiceRow>
                )
            })}
        </div>
    )
}

function DueSoonField() {
    const { t } = useI18n()
    const rules = useIssueStyle()
    const save = useSaveIssueStyle()
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
