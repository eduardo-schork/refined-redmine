import { useEffect, useState } from 'react'
import type { IssueDetail, Named } from '@domain/redmine/entities'
import { DONE_RATIO_STEPS, type EditableField, type IssueFieldsChange } from '@domain/redmine/issue-edit'
import { parseIssueSearch } from '@domain/redmine/issue-search'
import { isOverdue } from '@domain/redmine/queue'
import { parseHours } from '@domain/time/time-entry'
import { useEditIssue, useIssueEditOptions } from '@/hooks/issues'
import { usePriorities } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Input, Select } from '../atoms/fields'
import { PickList } from '../molecules/PickList'
import { Property } from '../molecules/surfaces'
import { useToast } from '../molecules/Toast'

const FIELD_LABELS: Record<EditableField, string> = {
    estimatedHours: 'issue.estimated',
    parentIssueId: 'issue.parentField',
    subject: 'issue.subject',
    description: 'issue.description',
    trackerId: 'issue.tracker',
    assignedToId: 'issue.assignee',
    fixedVersionId: 'issue.version',
    priorityId: 'issue.priority',
    startDate: 'issue.start',
    dueDate: 'issue.due',
    doneRatio: 'issue.done'
}

const NONE = ''

interface Option {
    value: string
    label: string
}

/** Keeps the current value selectable even when it is no longer among the options (closed version, ex-member). */
function withCurrent(options: Option[], current?: Named): Option[] {
    if (!current) return options
    const listed = options.some((option) => option.value === String(current.id))
    if (listed) return options
    return [{ value: String(current.id), label: current.name }, ...options]
}

/** Saves one field and says so. `onApplied` runs only when Redmine applied it (an editor can then close). */
export function useSaveField(issue: IssueDetail) {
    const { t, error } = useI18n()
    const toast = useToast()
    const edit = useEditIssue(issue.id)

    const save = (change: IssueFieldsChange, field: EditableField, valueText: string, onApplied?: () => void) => {
        edit.mutate(change, {
            onSuccess: (result) => {
                if (result.ignored.length) {
                    const fields = result.ignored.map((ignored) => t(FIELD_LABELS[ignored] as 'issue.assignee'))
                    toast(t('issue.edit.ignored', { fields: fields.join(', ') }), 'error')
                    return
                }
                toast(t('issue.edit.saved', { field: t(FIELD_LABELS[field] as 'issue.assignee'), value: valueText }))
                onApplied?.()
            },
            onError: (saveError) => toast(error(saveError), 'error')
        })
    }
    return { save, saving: edit.isPending }
}

function SelectField({
    value,
    options,
    disabled,
    onChange
}: {
    value: string
    options: Option[]
    disabled: boolean
    onChange: (value: string, label: string) => void
}) {
    const choose = (chosen: string) => {
        const label = options.find((option) => option.value === chosen)?.label ?? chosen
        onChange(chosen, label)
    }
    return (
        <Select value={value} disabled={disabled} onChange={(event) => choose(event.target.value)}>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </Select>
    )
}

/**
 * Saved when the field loses focus or on Enter, not on every change: while typing a year the date input
 * already holds valid (but wrong) dates such as 0002-10-05. When `onSave` refuses the text (returns false),
 * the field goes back to the saved value.
 */
function CommitField({
    saved,
    disabled,
    type = 'text',
    className,
    placeholder,
    onSave
}: {
    saved: string
    disabled: boolean
    type?: 'text' | 'date'
    className?: string
    placeholder?: string
    onSave: (text: string) => boolean | void
}) {
    const [draft, setDraft] = useState(saved)
    // When a save ends (accepted, refused or rejected by validation), the field shows what Redmine has.
    useEffect(() => {
        if (!disabled) setDraft(saved)
    }, [saved, disabled])
    const commit = () => {
        const text = draft.trim()
        if (text === saved) return
        if (onSave(text) === false) setDraft(saved)
    }
    return (
        <Input
            type={type}
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
            }}
        />
    )
}

interface FieldEditorProps {
    issue: IssueDetail
    disabled: boolean
    save: ReturnType<typeof useSaveField>['save']
}

/** Hours typed as 8, 1,5, 1:30 or 1h30; empty clears the estimate. */
function EstimateField({ issue, disabled, save }: FieldEditorProps) {
    const { t, dates } = useI18n()
    const toast = useToast()
    const saveEstimate = (text: string) => {
        const hours = text ? parseHours(text) : null
        if (text && hours === null) {
            toast(t('issue.edit.invalidHours'), 'error')
            return false
        }
        const valueText = hours === null ? t('issue.edit.noEstimate') : dates.hours(hours)
        save({ estimatedHours: hours }, 'estimatedHours', valueText)
    }
    return (
        <CommitField
            key={`estimate-${issue.estimated_hours}`}
            saved={dates.hoursInput(issue.estimated_hours)}
            disabled={disabled}
            placeholder={t('issue.edit.hoursPlaceholder')}
            onSave={saveEstimate}
        />
    )
}

/** "#1234" or "1234"; empty takes the issue out of its parent. Redmine refuses parents it does not accept. */
function ParentField({ issue, disabled, save }: FieldEditorProps) {
    const { t } = useI18n()
    const toast = useToast()
    const saveParent = (text: string) => {
        const reference = parseIssueSearch(text)
        if (text && reference.type !== 'id') {
            toast(t('issue.edit.invalidParent'), 'error')
            return false
        }
        const parentId = reference.type === 'id' ? reference.id : null
        const valueText = parentId === null ? t('issue.edit.noParent') : `#${parentId}`
        save({ parentIssueId: parentId }, 'parentIssueId', valueText)
    }
    return (
        <CommitField
            key={`parent-${issue.parent?.id}`}
            saved={issue.parent ? `#${issue.parent.id}` : NONE}
            disabled={disabled}
            placeholder="#1234"
            onSave={saveParent}
        />
    )
}

const toOptions = (items: Named[]): Option[] => items.map((item) => ({ value: String(item.id), label: item.name }))

/** Done % in steps of 10, plus the current value when Redmine has another one (e.g. 25%). */
function doneRatioOptions(current: number): Option[] {
    const steps = DONE_RATIO_STEPS.map((step) => ({ value: String(step), label: `${step}%` }))
    if (steps.some((option) => option.value === String(current))) return steps
    return [{ value: String(current), label: `${current}%` }, ...steps]
}

/** The choices of each field, keeping the issue's current value selectable. */
function useFieldOptions(issue: IssueDetail) {
    const { t } = useI18n()
    const priorities = usePriorities().data ?? []
    const options = useIssueEditOptions(issue.project.id).data
    return {
        loaded: Boolean(options),
        tracker: withCurrent(toOptions(options?.trackers ?? []), issue.tracker),
        priority: withCurrent(toOptions(priorities), issue.priority),
        assignee: [
            { value: NONE, label: t('issue.edit.nobody') },
            ...withCurrent(toOptions(options?.assignees ?? []), issue.assigned_to)
        ],
        version: [
            { value: NONE, label: t('issue.edit.noVersion') },
            ...withCurrent(toOptions(options?.versions ?? []), issue.fixed_version)
        ],
        doneRatio: doneRatioOptions(issue.done_ratio)
    }
}

/**
 * Tracker, priority, assignee, version, dates, done %, estimate and parent, edited in place; each change is saved to
 * Redmine at once.
 */
export function IssueFieldEditors({ issue, busy }: { issue: IssueDetail; busy: boolean }) {
    const { t, dates } = useI18n()
    const fieldOptions = useFieldOptions(issue)
    const { save, saving } = useSaveField(issue)
    const disabled = busy || saving
    const waitingOptions = disabled || !fieldOptions.loaded

    const idOrNull = (value: string) => (value ? Number(value) : null)
    const dateText = (value: string) => (value ? dates.date(value, true) : t('issue.edit.noDate'))

    return (
        <>
            <Property label={t('issue.tracker')}>
                <SelectField
                    value={String(issue.tracker.id)}
                    options={fieldOptions.tracker}
                    disabled={waitingOptions}
                    onChange={(value, label) => save({ trackerId: Number(value) }, 'trackerId', label)}
                />
            </Property>
            <Property label={t('issue.priority')}>
                <SelectField
                    value={String(issue.priority.id)}
                    options={fieldOptions.priority}
                    disabled={disabled}
                    onChange={(value, label) => save({ priorityId: Number(value) }, 'priorityId', label)}
                />
            </Property>
            <Property label={t('issue.assignee')}>
                {/* Changing the assignee notifies the other person: only a click on a name changes it. */}
                <PickList
                    value={issue.assigned_to ? String(issue.assigned_to.id) : NONE}
                    options={fieldOptions.assignee}
                    disabled={waitingOptions}
                    searchPlaceholder={t('issue.edit.searchPerson')}
                    noMatches={t('issue.edit.noPerson')}
                    onPick={(option) => save({ assignedToId: idOrNull(option.value) }, 'assignedToId', option.label)}
                />
            </Property>
            <Property label={t('issue.version')}>
                <PickList
                    value={issue.fixed_version ? String(issue.fixed_version.id) : NONE}
                    options={fieldOptions.version}
                    disabled={waitingOptions}
                    onPick={(option) =>
                        save({ fixedVersionId: idOrNull(option.value) }, 'fixedVersionId', option.label)
                    }
                />
            </Property>
            <Property label={t('issue.start')}>
                <CommitField
                    key={`start-${issue.start_date}`}
                    type="date"
                    saved={issue.start_date ?? NONE}
                    disabled={disabled}
                    onSave={(value) => save({ startDate: value || null }, 'startDate', dateText(value))}
                />
            </Property>
            <Property label={t('issue.due')}>
                <CommitField
                    key={`due-${issue.due_date}`}
                    type="date"
                    saved={issue.due_date ?? NONE}
                    disabled={disabled}
                    className={cn(isOverdue(issue, new Date()) && 'border-due-overdue/50 text-due-overdue')}
                    onSave={(value) => save({ dueDate: value || null }, 'dueDate', dateText(value))}
                />
            </Property>
            <Property label={t('issue.done')}>
                <SelectField
                    value={String(issue.done_ratio)}
                    options={fieldOptions.doneRatio}
                    disabled={disabled}
                    onChange={(value, label) => save({ doneRatio: Number(value) }, 'doneRatio', label)}
                />
            </Property>
            <Property label={t('issue.estimated')}>
                <EstimateField issue={issue} disabled={disabled} save={save} />
            </Property>
            <Property label={t('issue.parentField')}>
                <ParentField issue={issue} disabled={disabled} save={save} />
            </Property>
        </>
    )
}
