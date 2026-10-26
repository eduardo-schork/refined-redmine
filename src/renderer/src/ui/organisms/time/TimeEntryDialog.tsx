import { type FormEvent, useState } from 'react'
import { isEmptyChange, type BulkChange } from '@domain/redmine/issue-tree'
import { addDays, toLocalDate, type LocalDate } from '@domain/shared/date'
import { defaultActivityId, parseHours, type TimeEntryActivity, type TimeEntryDraft } from '@domain/time/time-entry'
import { useCommentAndChange, useIssue, useIssueEditOptions } from '@/hooks/issues'
import { useAddOvertime } from '@/hooks/overtime'
import { useEditTime, useLogTime, useTimeActivities } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { lastActivityId, rememberActivity } from '@/lib/last-activity'
import { Button } from '../../atoms/Button'
import { Input, Select, Textarea } from '../../atoms/fields'
import { Dialog } from '../../molecules/Dialog'
import { Field } from '../../molecules/Field'
import { PickList } from '../../molecules/PickList'
import { useToast } from '../../molecules/Toast'
import { ignoredNames } from '../handoff/TramiteDialog'

export interface TimeEntryDialogProps {
    issue: { id: number; subject?: string }
    /** Present when editing an existing entry. */
    entryId?: number
    initial?: Partial<Pick<TimeEntryDraft, 'spentOn' | 'hours' | 'activityId' | 'comments'>>
    onClose: () => void
    onSaved?: () => void
}

function DateShortcuts({ onPick }: { onPick: (date: LocalDate) => void }) {
    const { t } = useI18n()
    const today = new Date()
    return (
        <div className="flex gap-1">
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => onPick(toLocalDate(today))}>
                {t('time.today')}
            </Button>
            <Button
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => onPick(toLocalDate(addDays(today, -1)))}
            >
                {t('time.yesterday')}
            </Button>
        </div>
    )
}

function useSaveEntry(props: TimeEntryDialogProps) {
    const { t, error, dates } = useI18n()
    const toast = useToast()
    const log = useLogTime()
    const edit = useEditTime()
    const addOvertime = useAddOvertime()
    const commentAndChange = useCommentAndChange()

    /** Status or assignee chosen in the dialog, applied after the time is logged. */
    const applyChange = async (issueId: number, change: BulkChange) => {
        try {
            const result = await commentAndChange.mutateAsync({ id: issueId, change, uploads: [] })
            if (result.outcome === 'partial') {
                toast(t('bulk.ignored', { fields: ignoredNames(result.ignored, t) }), 'error')
            }
        } catch (changeError) {
            toast(error(changeError), 'error')
        }
    }

    /** `overtime`: the part of the hours worked as overtime, also kept in the app's overtime bank. */
    const save = async (draft: TimeEntryDraft, overtime: number, change: BulkChange) => {
        try {
            if (props.entryId) await edit.mutateAsync({ id: props.entryId, draft })
            else await log.mutateAsync(draft)
        } catch (saveError) {
            toast(error(saveError), 'error')
            return
        }
        rememberActivity(draft.activityId)
        if (overtime) {
            const entry = { day: draft.spentOn, hours: overtime, issueId: draft.issueId, note: draft.comments }
            addOvertime.mutate(entry, { onError: (bankError) => toast(error(bankError), 'error') })
        }
        const message = props.entryId ? 'time.updated' : 'time.logged'
        toast(t(message, { hours: dates.hours(draft.hours), id: draft.issueId }))
        if (!isEmptyChange(change)) await applyChange(draft.issueId, change)
        props.onSaved?.()
        props.onClose()
    }
    return { save, saving: log.isPending || edit.isPending || commentAndChange.isPending }
}

const NOBODY = 'nobody'

/** Undefined keeps the assignee; null leaves the issue with nobody. */
function assigneeChange(assignee: string | undefined): number | null | undefined {
    if (assignee === undefined) return undefined
    if (assignee === NOBODY) return null
    return Number(assignee)
}

/**
 * Status and assignee to set together with the time ("stopped the stopwatch and it goes back to Ana"). Both start
 * at the issue's current values, which change nothing.
 */
function useIssueChange(issueId: number, enabled: boolean) {
    const issue = useIssue(issueId, enabled).data
    const people = useIssueEditOptions(issue?.project.id ?? 0, Boolean(issue)).data?.assignees ?? []
    const [statusId, setStatusId] = useState<number>()
    const [assignee, setAssignee] = useState<string>()
    const currentAssignee = issue?.assigned_to ? String(issue.assigned_to.id) : NOBODY
    const change: BulkChange = { statusId, assignedToId: assigneeChange(assignee) }
    return {
        issue,
        people,
        statusId: statusId ?? issue?.status.id,
        setStatusId,
        assignee: assignee ?? currentAssignee,
        setAssignee,
        change
    }
}

function IssueChangeFields({ change }: { change: ReturnType<typeof useIssueChange> }) {
    const { t } = useI18n()
    const issue = change.issue
    if (!issue) return null
    const statuses = issue.allowed_statuses.some((status) => status.id === issue.status.id)
        ? issue.allowed_statuses
        : [issue.status, ...issue.allowed_statuses]
    const people = [
        { value: NOBODY, label: t('issue.edit.nobody') },
        ...change.people.map((person) => ({ value: String(person.id), label: person.name })),
        ...(issue.assigned_to && !change.people.some((person) => person.id === issue.assigned_to?.id)
            ? [{ value: String(issue.assigned_to.id), label: issue.assigned_to.name }]
            : [])
    ]
    return (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div>
                <h3 className="text-xs font-medium text-muted">{t('time.alsoChange')}</h3>
                <p className="text-xs text-muted">{t('time.alsoChangeHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Field label={t('issue.status')}>
                    <Select
                        value={change.statusId ?? ''}
                        onChange={(event) => change.setStatusId(Number(event.target.value))}
                    >
                        {statuses.map((status) => (
                            <option key={status.id} value={status.id}>
                                {status.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">{t('issue.assignee')}</span>
                    <PickList
                        value={change.assignee}
                        options={people}
                        searchPlaceholder={t('issue.edit.searchPerson')}
                        noMatches={t('issue.edit.noPerson')}
                        onPick={(option) => change.setAssignee(option.value)}
                    />
                </div>
            </div>
        </div>
    )
}

/** The part of the hours that was overtime: optional, never more than the hours. */
function useOvertimeInput(hours: number | null) {
    const [typedOvertime, setTypedOvertime] = useState('')
    const overtime = typedOvertime.trim() ? parseHours(typedOvertime) : 0
    const overtimeValid = overtime !== null && (hours === null || overtime <= hours)
    return { typedOvertime, setTypedOvertime, overtime, overtimeValid }
}

function useEntryForm(initial: TimeEntryDialogProps['initial']) {
    const { dates } = useI18n()
    const activities = useTimeActivities().data ?? []
    const [spentOn, setSpentOn] = useState(initial?.spentOn ?? toLocalDate(new Date()))
    const [typedHours, setTypedHours] = useState(dates.hoursInput(initial?.hours))
    const [chosenActivity, setChosenActivity] = useState<number | undefined>(initial?.activityId)
    const [comments, setComments] = useState(initial?.comments ?? '')
    const hours = parseHours(typedHours)
    const activityId = chosenActivity ?? defaultActivityId(activities, lastActivityId())
    const overtimeInput = useOvertimeInput(hours)
    const complete = hours !== null && hours > 0 && comments.trim().length > 0 && overtimeInput.overtimeValid
    return {
        ...overtimeInput,
        activities,
        spentOn,
        setSpentOn,
        typedHours,
        setTypedHours,
        hours,
        activityId,
        setChosenActivity,
        comments,
        setComments,
        complete
    }
}

function HoursField({
    typed,
    hours,
    onChange
}: {
    typed: string
    hours: number | null
    onChange: (value: string) => void
}) {
    const { t, dates } = useI18n()
    const invalid = typed.trim() !== '' && hours === null
    return (
        <Field label={t('time.hours')} hint={invalid ? t('time.hoursInvalid') : t('time.hoursHint')}>
            <div className="flex items-center gap-2">
                <Input
                    autoFocus
                    required
                    inputMode="decimal"
                    placeholder="1,5"
                    value={typed}
                    onChange={(event) => onChange(event.target.value)}
                />
                {hours !== null && <span className="shrink-0 text-sm text-muted">= {dates.hours(hours)}</span>}
            </div>
        </Field>
    )
}

/** Hidden when Redmine has a single activity: there is nothing to choose. */
function ActivityField({
    activities,
    value,
    onChange
}: {
    activities: TimeEntryActivity[]
    value?: number
    onChange: (activityId: number) => void
}) {
    const { t } = useI18n()
    if (activities.length < 2) return null
    return (
        <Field label={t('time.activity')} hint={t('time.activityHint')}>
            <Select value={value ?? ''} onChange={(event) => onChange(Number(event.target.value))}>
                {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                        {activity.name}
                    </option>
                ))}
            </Select>
        </Field>
    )
}

/** Log time on an issue, or edit an entry: date, hours (1,5 · 1:30 · 1h30 · 90m), activity and comment. */
export function TimeEntryDialog(props: TimeEntryDialogProps) {
    const { t } = useI18n()
    const { issue, initial, entryId, onClose } = props
    const form = useEntryForm(initial)
    const { save, saving } = useSaveEntry(props)
    const issueChange = useIssueChange(issue.id, !entryId)
    const canSave = form.complete && !saving

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canSave || form.hours === null) return
        const { spentOn, hours, activityId, comments } = form
        const change = entryId ? {} : issueChange.change
        void save({ issueId: issue.id, spentOn, hours, activityId, comments }, form.overtime ?? 0, change)
    }

    const title = entryId ? t('time.editTitle', { id: issue.id }) : t('time.logTitle', { id: issue.id })
    return (
        <Dialog title={title} onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {issue.subject && <p className="-mt-1 truncate text-sm text-muted">{issue.subject}</p>}
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('time.date')}>
                        <Input
                            type="date"
                            required
                            value={form.spentOn}
                            onChange={(event) => form.setSpentOn(event.target.value)}
                        />
                        <DateShortcuts onPick={form.setSpentOn} />
                    </Field>
                    <HoursField typed={form.typedHours} hours={form.hours} onChange={form.setTypedHours} />
                </div>
                <ActivityField activities={form.activities} value={form.activityId} onChange={form.setChosenActivity} />
                {!entryId && (
                    <Field
                        label={t('overtime.ofTheseHours')}
                        hint={form.overtimeValid ? t('overtime.ofTheseHoursHint') : t('overtime.tooMuch')}
                    >
                        <Input
                            className="w-32"
                            inputMode="decimal"
                            placeholder="0"
                            value={form.typedOvertime}
                            onChange={(event) => form.setTypedOvertime(event.target.value)}
                        />
                    </Field>
                )}
                <Field label={t('time.comment')}>
                    <Textarea
                        required
                        className="min-h-20"
                        placeholder={t('time.commentPlaceholder')}
                        value={form.comments}
                        onChange={(event) => form.setComments(event.target.value)}
                    />
                </Field>
                {!entryId && <IssueChangeFields change={issueChange} />}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button variant="primary" type="submit" disabled={!canSave}>
                        {saving ? t('time.saving') : t('time.save')}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
