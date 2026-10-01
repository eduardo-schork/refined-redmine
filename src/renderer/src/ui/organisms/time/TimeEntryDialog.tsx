import { type FormEvent, useState } from 'react'
import { addDays, toLocalDate, type LocalDate } from '@domain/shared/date'
import { defaultActivityId, parseHours, type TimeEntryActivity, type TimeEntryDraft } from '@domain/time/time-entry'
import { useEditTime, useLogTime, useTimeActivities } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { lastActivityId, rememberActivity } from '@/lib/last-activity'
import { Button } from '../../atoms/Button'
import { Input, Select, Textarea } from '../../atoms/fields'
import { Dialog } from '../../molecules/Dialog'
import { Field } from '../../molecules/Field'
import { useToast } from '../../molecules/Toast'

export interface TimeEntryDialogProps {
    issue: { id: number; subject?: string }
    /** Present when editing an existing entry. */
    entryId?: number
    initial?: Partial<Pick<TimeEntryDraft, 'spentOn' | 'hours' | 'activityId' | 'comments'>>
    onClose: () => void
    onSaved?: () => void
}

/** 1.5 → "1,5" in Portuguese: the field shows hours the way people type them. */
function hoursText(hours: number | undefined, locale: string): string {
    if (!hours) return ''
    return hours.toLocaleString(locale, { maximumFractionDigits: 2 })
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
    const save = (draft: TimeEntryDraft) => {
        const done = () => {
            rememberActivity(draft.activityId)
            const message = props.entryId ? 'time.updated' : 'time.logged'
            toast(t(message, { hours: dates.hours(draft.hours), id: draft.issueId }))
            props.onSaved?.()
            props.onClose()
        }
        const failed = (saveError: unknown) => toast(error(saveError), 'error')
        if (props.entryId) edit.mutate({ id: props.entryId, draft }, { onSuccess: done, onError: failed })
        else log.mutate(draft, { onSuccess: done, onError: failed })
    }
    return { save, saving: log.isPending || edit.isPending }
}

function useEntryForm(initial: TimeEntryDialogProps['initial']) {
    const { locale } = useI18n()
    const activities = useTimeActivities().data ?? []
    const [spentOn, setSpentOn] = useState(initial?.spentOn ?? toLocalDate(new Date()))
    const [typedHours, setTypedHours] = useState(hoursText(initial?.hours, locale))
    const [chosenActivity, setChosenActivity] = useState<number | undefined>(initial?.activityId)
    const [comments, setComments] = useState(initial?.comments ?? '')
    const hours = parseHours(typedHours)
    const activityId = chosenActivity ?? defaultActivityId(activities, lastActivityId())
    const complete = hours !== null && hours > 0 && comments.trim().length > 0
    return {
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
    const canSave = form.complete && !saving

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canSave || form.hours === null) return
        const { spentOn, hours, activityId, comments } = form
        save({ issueId: issue.id, spentOn, hours, activityId, comments })
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
                <Field label={t('time.comment')}>
                    <Textarea
                        required
                        className="min-h-20"
                        placeholder={t('time.commentPlaceholder')}
                        value={form.comments}
                        onChange={(event) => form.setComments(event.target.value)}
                    />
                </Field>
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
