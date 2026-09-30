import { useEffect, useState } from 'react'
import type { IssueDetail, Named } from '@domain/redmine/entities'
import { DONE_RATIO_STEPS, type EditableField, type IssueFieldsChange } from '@domain/redmine/issue-edit'
import { isOverdue } from '@domain/redmine/queue'
import { useEditIssue, useIssueEditOptions } from '@/hooks/issues'
import { usePriorities } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Input, Select } from '../atoms/fields'
import { PickList } from '../molecules/PickList'
import { Property } from '../molecules/surfaces'
import { useToast } from '../molecules/Toast'

const FIELD_LABELS: Record<EditableField, string> = {
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

function useSaveField(issue: IssueDetail) {
    const { t, error } = useI18n()
    const toast = useToast()
    const edit = useEditIssue(issue.id)

    const save = (change: IssueFieldsChange, field: EditableField, valueText: string) => {
        edit.mutate(change, {
            onSuccess: (result) => {
                if (result.ignored.length) {
                    const fields = result.ignored.map((ignored) => t(FIELD_LABELS[ignored] as 'issue.assignee'))
                    toast(t('issue.edit.ignored', { fields: fields.join(', ') }), 'error')
                    return
                }
                toast(t('issue.edit.saved', { field: t(FIELD_LABELS[field] as 'issue.assignee'), value: valueText }))
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
 * already holds valid (but wrong) dates such as 0002-10-05.
 */
function DateField({
    value,
    disabled,
    highlight,
    onSave
}: {
    value: string | null | undefined
    disabled: boolean
    highlight: boolean
    onSave: (value: string | null) => void
}) {
    const saved = value ?? NONE
    const [draft, setDraft] = useState(saved)
    // When a save ends (accepted, refused or rejected by validation), the field shows what Redmine has.
    useEffect(() => {
        if (!disabled) setDraft(saved)
    }, [saved, disabled])
    const commit = () => {
        if (draft === saved) return
        onSave(draft || null)
    }
    return (
        <Input
            type="date"
            value={draft}
            disabled={disabled}
            className={cn(highlight && 'border-danger/50 text-danger')}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
            }}
        />
    )
}

/** Priority, assignee, version, dates and done %, edited in place; each change is saved to Redmine at once. */
export function IssueFieldEditors({ issue, busy }: { issue: IssueDetail; busy: boolean }) {
    const { t, dates } = useI18n()
    const priorities = usePriorities().data ?? []
    const options = useIssueEditOptions(issue.project.id).data
    const { save, saving } = useSaveField(issue)
    const disabled = busy || saving

    const priorityOptions = withCurrent(
        priorities.map((priority) => ({ value: String(priority.id), label: priority.name })),
        issue.priority
    )
    const assigneeOptions = [
        { value: NONE, label: t('issue.edit.nobody') },
        ...withCurrent(
            (options?.assignees ?? []).map((member) => ({ value: String(member.id), label: member.name })),
            issue.assigned_to
        )
    ]
    const versionOptions = [
        { value: NONE, label: t('issue.edit.noVersion') },
        ...withCurrent(
            (options?.versions ?? []).map((version) => ({ value: String(version.id), label: version.name })),
            issue.fixed_version
        )
    ]
    const doneOptions = DONE_RATIO_STEPS.map((step) => ({ value: String(step), label: `${step}%` }))
    const currentDone = doneOptions.some((option) => option.value === String(issue.done_ratio))
        ? doneOptions
        : [{ value: String(issue.done_ratio), label: `${issue.done_ratio}%` }, ...doneOptions]
    const idOrNull = (value: string) => (value ? Number(value) : null)
    const dateText = (value: string | null) => (value ? dates.date(value, true) : t('issue.edit.noDate'))

    return (
        <>
            <Property label={t('issue.priority')}>
                <SelectField
                    value={String(issue.priority.id)}
                    options={priorityOptions}
                    disabled={disabled}
                    onChange={(value, label) => save({ priorityId: Number(value) }, 'priorityId', label)}
                />
            </Property>
            <Property label={t('issue.assignee')}>
                {/* Changing the assignee notifies the other person: only a click on a name changes it. */}
                <PickList
                    value={issue.assigned_to ? String(issue.assigned_to.id) : NONE}
                    options={assigneeOptions}
                    disabled={disabled || !options}
                    searchPlaceholder={t('issue.edit.searchPerson')}
                    noMatches={t('issue.edit.noPerson')}
                    onPick={(option) => save({ assignedToId: idOrNull(option.value) }, 'assignedToId', option.label)}
                />
            </Property>
            <Property label={t('issue.version')}>
                <SelectField
                    value={issue.fixed_version ? String(issue.fixed_version.id) : NONE}
                    options={versionOptions}
                    disabled={disabled || !options}
                    onChange={(value, label) => save({ fixedVersionId: idOrNull(value) }, 'fixedVersionId', label)}
                />
            </Property>
            <Property label={t('issue.start')}>
                <DateField
                    key={`start-${issue.start_date}`}
                    value={issue.start_date}
                    disabled={disabled}
                    highlight={false}
                    onSave={(value) => save({ startDate: value }, 'startDate', dateText(value))}
                />
            </Property>
            <Property label={t('issue.due')}>
                <DateField
                    key={`due-${issue.due_date}`}
                    value={issue.due_date}
                    disabled={disabled}
                    highlight={isOverdue(issue, new Date())}
                    onSave={(value) => save({ dueDate: value }, 'dueDate', dateText(value))}
                />
            </Property>
            <Property label={t('issue.done')}>
                <SelectField
                    value={String(issue.done_ratio)}
                    options={currentDone}
                    disabled={disabled}
                    onChange={(value, label) => save({ doneRatio: Number(value) }, 'doneRatio', label)}
                />
            </Property>
        </>
    )
}
