import { useState, type ReactNode } from 'react'
import { Plus, Send, X } from 'lucide-react'
import type { ClosingStep, HandoffRule } from '@domain/automation/handoff'
import type { Named } from '@domain/redmine/entities'
import { useIssueEditOptions } from '@/hooks/issues'
import { useProjects, useStatuses, useTrackers } from '@/hooks/reference'
import { useTimeActivities } from '@/hooks/time'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { Input, Select, Textarea } from '../../atoms/fields'
import { IconButton } from '../../atoms/IconButton'
import { Dialog } from '../../molecules/Dialog'
import { Field, ToggleField } from '../../molecules/Field'
import { IconChoice } from '../../molecules/IconChoice'
import { PickList } from '../../molecules/PickList'
import { SegmentedControl } from '../../molecules/SegmentedControl'

const NONE = ''
const optionalNumber = (value: string) => (value ? Number(value) : undefined)

type Change = (patch: Partial<HandoffRule>) => void

/** Edits one "trâmite" rule: where its button shows, what it changes and the comment it writes. */
export function HandoffRuleEditor({
    rule,
    saving,
    onSave,
    onClose
}: {
    rule: HandoffRule
    saving: boolean
    onSave: (rule: HandoffRule) => void
    onClose: () => void
}) {
    const { t } = useI18n()
    const [draft, setDraft] = useState(rule)
    const change: Change = (patch) => setDraft((current) => ({ ...current, ...patch }))
    const isOther = draft.mode === 'other'

    const footer = (
        <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!draft.name.trim() || saving} onClick={() => onSave(draft)}>
                {t('automation.save')}
            </Button>
        </>
    )

    return (
        <Dialog title={t('automation.editorTitle')} onClose={onClose} size="lg" footer={footer}>
            <div className="flex flex-col gap-4">
                <SegmentedControl
                    value={draft.mode}
                    options={[
                        { value: 'other', label: t('automation.modes.other') },
                        { value: 'same', label: t('automation.modes.same') }
                    ]}
                    onChange={(mode) => change({ mode })}
                />
                <p className="-mt-2 text-xs text-muted">{t(`automation.modeHints.${draft.mode}`)}</p>
                <Field label={t('automation.name')}>
                    <Input
                        autoFocus
                        value={draft.name}
                        placeholder={t('automation.namePlaceholder')}
                        onChange={(event) => change({ name: event.target.value })}
                    />
                </Field>
                <Labeled label={t('automation.icon')}>
                    <IconChoice value={draft.icon} fallback={Send} onChange={(icon) => change({ icon })} />
                </Labeled>
                <VisibilityFields draft={draft} change={change} />
                <DefaultsFields draft={draft} change={change} />
                <TemplateFields draft={draft} change={change} />
                <ToggleField
                    checked={draft.bulk}
                    onChange={(bulk) => change({ bulk })}
                    label={t('automation.bulk')}
                    description={t('automation.bulkHint')}
                />
                <TimeFields draft={draft} change={change} />
                {isOther && <ClosingStepsFields draft={draft} change={change} />}
            </div>
        </Dialog>
    )
}

/** Toggle chips: none checked means "all". */
export function ChipChoice({
    options,
    chosen,
    onChange
}: {
    options: Named[]
    chosen: number[]
    onChange: (ids: number[]) => void
}) {
    const toggle = (id: number) =>
        onChange(chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id])
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    aria-pressed={chosen.includes(option.id)}
                    onClick={() => toggle(option.id)}
                    className={cn(
                        'cursor-default rounded-full border px-2.5 py-0.5 text-xs',
                        chosen.includes(option.id)
                            ? 'border-accent/50 bg-accent-soft text-accent'
                            : 'border-line text-muted hover:text-fg'
                    )}
                >
                    {option.name}
                </button>
            ))}
        </div>
    )
}

/** Not in a <Field>: its <label> would turn clicks on the chips into clicks on the first one. */
export function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{label}</span>
            {children}
            {hint && <span className="text-xs text-muted">{hint}</span>}
        </div>
    )
}

function VisibilityFields({ draft, change }: { draft: HandoffRule; change: Change }) {
    const { t } = useI18n()
    const trackers = useTrackers().data ?? []
    const statuses = useStatuses().data ?? []
    return (
        <>
            <Labeled label={t('automation.trackers')} hint={t('automation.noneMeansAll')}>
                <ChipChoice
                    options={trackers}
                    chosen={draft.trackerIds}
                    onChange={(trackerIds) => change({ trackerIds })}
                />
            </Labeled>
            <Labeled label={t('automation.statuses')} hint={t('automation.noneMeansAll')}>
                <ChipChoice
                    options={statuses}
                    chosen={draft.statusIds}
                    onChange={(statusIds) => change({ statusIds })}
                />
            </Labeled>
        </>
    )
}

function DefaultsFields({ draft, change }: { draft: HandoffRule; change: Change }) {
    const { t } = useI18n()
    const trackers = useTrackers().data ?? []
    const statuses = useStatuses().data ?? []
    return (
        <div className="grid grid-cols-2 gap-4">
            {draft.mode === 'other' && (
                <Field label={t('automation.targetTracker')}>
                    <Select
                        value={draft.targetTrackerId ?? NONE}
                        onChange={(event) => change({ targetTrackerId: optionalNumber(event.target.value) })}
                    >
                        <option value={NONE}>{t('automation.anyTracker')}</option>
                        {trackers.map((tracker) => (
                            <option key={tracker.id} value={tracker.id}>
                                {tracker.name}
                            </option>
                        ))}
                    </Select>
                </Field>
            )}
            <Field label={t('automation.defaultStatus')}>
                <Select
                    value={draft.statusId ?? NONE}
                    onChange={(event) => change({ statusId: optionalNumber(event.target.value) })}
                >
                    <option value={NONE}>{t('bulk.keep')}</option>
                    {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                            {status.name}
                        </option>
                    ))}
                </Select>
            </Field>
            <AssigneeField draft={draft} change={change} />
        </div>
    )
}

/** The project only helps to list people; it is not saved with the rule. */
function AssigneeField({ draft, change }: { draft: HandoffRule; change: Change }) {
    const { t } = useI18n()
    const projects = useProjects().data ?? []
    const [projectId, setProjectId] = useState<number>()
    const people = useIssueEditOptions(projectId ?? 0, projectId !== undefined).data?.assignees ?? []
    const known = draft.assigneeId && !people.some((person) => person.id === draft.assigneeId)
    const choose = (value: string) => {
        const person = people.find((candidate) => candidate.id === Number(value))
        change({ assigneeId: person?.id, assigneeName: person?.name })
    }
    return (
        <div className="col-span-2 grid grid-cols-2 gap-4">
            <Labeled label={t('automation.peopleFrom')}>
                <PickList
                    value={projectId === undefined ? '' : String(projectId)}
                    options={projects.map((project) => ({ value: String(project.id), label: project.name }))}
                    disabled={false}
                    searchPlaceholder={t('issue.create.searchProject')}
                    noMatches={t('issue.create.noProject')}
                    onPick={(option) => setProjectId(Number(option.value))}
                />
            </Labeled>
            <Field label={t('automation.defaultAssignee')}>
                <PickList
                    value={draft.assigneeId === undefined ? NONE : String(draft.assigneeId)}
                    options={[
                        { value: NONE, label: t('bulk.keep') },
                        ...(known ? [{ value: String(draft.assigneeId), label: draft.assigneeName ?? '' }] : []),
                        ...people.map((person) => ({ value: String(person.id), label: person.name }))
                    ]}
                    searchPlaceholder={t('issue.edit.searchPerson')}
                    noMatches={t('issue.edit.noPerson')}
                    onPick={(option) => choose(option.value)}
                />
            </Field>
        </div>
    )
}

function TemplateFields({ draft, change }: { draft: HandoffRule; change: Change }) {
    const { t } = useI18n()
    if (draft.mode === 'same') {
        return (
            <Field label={t('automation.sameTemplate')} hint={t('automation.sameTemplateHint')}>
                <Textarea
                    className="min-h-16 font-mono text-xs"
                    value={draft.template}
                    onChange={(event) => change({ template: event.target.value })}
                />
            </Field>
        )
    }
    return (
        <>
            <Field label={t('automation.template')} hint={t('automation.templateHint')}>
                <Textarea
                    className="min-h-12 font-mono text-xs"
                    value={draft.template}
                    onChange={(event) => change({ template: event.target.value })}
                />
            </Field>
            <Field label={t('automation.multiTemplate')}>
                <Textarea
                    className="min-h-16 font-mono text-xs"
                    value={draft.multiTemplate}
                    onChange={(event) => change({ multiTemplate: event.target.value })}
                />
            </Field>
        </>
    )
}

function TimeFields({ draft, change }: { draft: HandoffRule; change: Change }) {
    const { t } = useI18n()
    const activities = useTimeActivities().data ?? []
    return (
        <>
            <ToggleField
                checked={draft.logTime}
                onChange={(logTime) => change({ logTime })}
                label={t('automation.logTime')}
            />
            {draft.logTime && (
                <Field label={t('automation.activity')}>
                    <Select
                        className="w-64"
                        value={draft.timeActivityId ?? NONE}
                        onChange={(event) => change({ timeActivityId: optionalNumber(event.target.value) })}
                    >
                        <option value={NONE}>{t('automation.chooseLater')}</option>
                        {activities.map((activity) => (
                            <option key={activity.id} value={activity.id}>
                                {activity.name}
                            </option>
                        ))}
                    </Select>
                </Field>
            )}
        </>
    )
}

function ClosingStepsFields({ draft, change }: { draft: HandoffRule; change: Change }) {
    const { t } = useI18n()
    const trackers = useTrackers().data ?? []
    const statuses = useStatuses().data ?? []
    const steps = draft.closingSteps
    const setStep = (index: number, patch: Partial<ClosingStep>) =>
        change({ closingSteps: steps.map((step, position) => (position === index ? { ...step, ...patch } : step)) })
    return (
        <Labeled label={t('automation.closing')} hint={t('automation.closingHint')}>
            {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                    <Select
                        value={step.trackerId || NONE}
                        onChange={(event) => setStep(index, { trackerId: Number(event.target.value) })}
                    >
                        <option value={NONE}>{t('automation.pickTracker')}</option>
                        {trackers.map((tracker) => (
                            <option key={tracker.id} value={tracker.id}>
                                {tracker.name}
                            </option>
                        ))}
                    </Select>
                    <span className="text-muted">→</span>
                    <Select
                        value={step.statusId || NONE}
                        onChange={(event) => setStep(index, { statusId: Number(event.target.value) })}
                    >
                        <option value={NONE}>{t('automation.pickStatus')}</option>
                        {statuses.map((status) => (
                            <option key={status.id} value={status.id}>
                                {status.name}
                            </option>
                        ))}
                    </Select>
                    <IconButton
                        label={t('automation.removeStep')}
                        icon={<X size={14} />}
                        size="sm"
                        onClick={() => change({ closingSteps: steps.filter((_, position) => position !== index) })}
                    />
                </div>
            ))}
            <Button
                variant="ghost"
                className="self-start"
                onClick={() => change({ closingSteps: [...steps, { trackerId: 0, statusId: 0 }] })}
            >
                <Plus size={14} /> {t('automation.addStep')}
            </Button>
        </Labeled>
    )
}
