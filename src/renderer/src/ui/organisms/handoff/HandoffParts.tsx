import { useEffect, useMemo, useRef, useState } from 'react'
import { NEW_TRAMITE_RULE, type HandoffRule } from '@domain/automation/handoff'
import { defaultSince, hoursSinceOptions, type SinceOption } from '@domain/automation/hours-since'
import type { Attachment, IssueDetail } from '@domain/redmine/entities'
import { splitWorkTime } from '@domain/time/business-hours'
import { elapsedHours, elapsedMs, formatClock } from '@domain/time/timer'
import { toLocalDate } from '@domain/shared/date'
import { defaultActivityId, parseHours, type TimeEntryDraft } from '@domain/time/time-entry'
import type { IssueUpload } from '@domain/redmine/issue-upload'
import { useAddOvertime } from '@/hooks/overtime'
import { useSettings } from '@/hooks/session'
import { useIssueTime, useLogTime, useTimeActivities, useTimer, useTimerActions } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { lastActivityId } from '@/lib/last-activity'
import type { Step } from '@/lib/steps'
import { Input, Select } from '../../atoms/fields'
import { AttachmentPicker } from '../../molecules/AttachmentPicker'
import { Field } from '../../molecules/Field'
import { UploadPreviewDialog } from '../attachments/UploadPreviewDialog'
import { type useChosenFiles } from '../IssueCreateDialog'
import { MarkdownEditor } from '../MarkdownEditor'

const TIMER = 'timer'
const TYPED = ''

/** Moments the hours can be counted from: the stopwatch running on this issue, or a moment of the issue. */
function useHoursSources(issue: IssueDetail, enabled: boolean) {
    const settings = useSettings()
    const timerQuery = useTimer()
    const entriesQuery = useIssueTime(issue.id)
    const timer = timerQuery.data?.issueId === issue.id ? timerQuery.data : undefined
    const entries = entriesQuery.data
    const options = useMemo(
        () => hoursSinceOptions(issue, entries ?? [], settings.user?.id),
        [issue, entries, settings.user?.id]
    )
    const loaded = enabled && timerQuery.isSuccess && entriesQuery.isSuccess
    return { timer, options, loaded, schedule: settings.workSchedule }
}

/**
 * Hours logged with a handoff: empty means nothing is logged. Typed hours that cannot be read, or an overtime part
 * larger than the hours, block sending. The overtime part also goes to the app's overtime bank. The hours come from
 * the stopwatch running on the issue; without it, a configured rule counts them from the user's last trâmite
 * (split by the working hours into normal time and overtime), and any moment of the issue can be picked instead.
 */
export function useHandoffHours(rule: HandoffRule, issue: IssueDetail) {
    const { dates } = useI18n()
    const activities = useTimeActivities().data ?? []
    const sources = useHoursSources(issue, rule.logTime)
    const [source, setSource] = useState(TYPED)
    const [typedHours, setTypedHours] = useState('')
    const [typedOvertime, setTypedOvertime] = useState('')
    const [chosenActivity, setChosenActivity] = useState<number | undefined>(rule.timeActivityId)
    const hours = typedHours.trim() ? parseHours(typedHours) : undefined
    const overtime = typedOvertime.trim() ? parseHours(typedOvertime) : 0
    const activityId = chosenActivity ?? defaultActivityId(activities, lastActivityId())
    const unreadable = hours === null || overtime === null
    const overtimeTooLarge = hours != null && overtime != null && overtime > hours

    const countFrom = (key: string) => {
        setSource(key)
        if (key === TIMER && sources.timer) {
            setTypedHours(dates.hoursInput(elapsedHours(sources.timer, new Date())))
            setTypedOvertime('')
            return
        }
        const since = sources.options.find((option) => option.key === key)
        if (!since) return
        const split = splitWorkTime(new Date(since.at), new Date(), sources.schedule)
        const total = Math.round((split.business + split.overtime) * 100) / 100
        setTypedHours(total ? dates.hoursInput(total) : '')
        setTypedOvertime(split.overtime ? dates.hoursInput(split.overtime) : '')
    }

    // Filled once when the dialog opens. "Novo trâmite" starts empty unless the stopwatch runs on the issue.
    const prefilled = useRef(false)
    useEffect(() => {
        if (prefilled.current || !sources.loaded) return
        prefilled.current = true
        if (sources.timer) countFrom(TIMER)
        else if (rule.id !== NEW_TRAMITE_RULE.id) countFrom(defaultSince(sources.options)?.key ?? TYPED)
    })

    return {
        enabled: rule.logTime,
        activities,
        typedHours,
        setTypedHours,
        typedOvertime,
        setTypedOvertime,
        activityId,
        setChosenActivity,
        hours: hours ?? undefined,
        overtime: overtime ?? 0,
        blocked: rule.logTime && (unreadable || overtimeTooLarge),
        source,
        countFrom,
        timer: sources.timer,
        sinceOptions: sources.options,
        fromTimer: source === TIMER
    }
}

export type HandoffHours = ReturnType<typeof useHandoffHours>

function CountFromField({ hours }: { hours: HandoffHours }) {
    const { t, dates } = useI18n()
    const sinceLabel = (option: SinceOption) => {
        const kind = t(`handoff.since.${option.kind}`, { hours: dates.hours(option.hours) })
        return `${kind} · ${option.who} · ${dates.dateTime(option.at)}`
    }
    return (
        <Field label={t('handoff.countFrom')} hint={t('handoff.countFromHint')}>
            <Select value={hours.source} onChange={(event) => hours.countFrom(event.target.value)}>
                <option value={TYPED}>{t('handoff.typeHours')}</option>
                {hours.timer && (
                    <option value={TIMER}>
                        {t('handoff.fromTimer', { time: formatClock(elapsedMs(hours.timer, new Date())) })}
                    </option>
                )}
                {hours.sinceOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                        {sinceLabel(option)}
                    </option>
                ))}
            </Select>
        </Field>
    )
}

export function HoursFields({ hours }: { hours: HandoffHours }) {
    const { t } = useI18n()
    if (!hours.enabled) return null
    return (
        <div className="flex flex-col gap-3">
            <CountFromField hours={hours} />
            <div className="grid grid-cols-3 gap-4">
                <Field label={t('handoff.hours')} hint={t('time.hoursHint')}>
                    <Input
                        inputMode="decimal"
                        placeholder={t('handoff.noHours')}
                        value={hours.typedHours}
                        onChange={(event) => hours.setTypedHours(event.target.value)}
                    />
                </Field>
                <Field label={t('overtime.ofTheseHours')}>
                    <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={hours.typedOvertime}
                        onChange={(event) => hours.setTypedOvertime(event.target.value)}
                    />
                </Field>
                {hours.activities.length > 1 && (
                    <Field label={t('time.activity')}>
                        <Select
                            value={hours.activityId ?? ''}
                            onChange={(event) => hours.setChosenActivity(Number(event.target.value))}
                        >
                            {hours.activities.map((activity) => (
                                <option key={activity.id} value={activity.id}>
                                    {activity.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                )}
            </div>
        </div>
    )
}

/** The time entry (and overtime) steps of a handoff, logged today on `issueId`. */
export function useTimeSteps(hours: HandoffHours, issueId: number, comment: string): Step[] {
    const { t } = useI18n()
    const logTime = useLogTime()
    const addOvertime = useAddOvertime()
    const timerActions = useTimerActions()
    if (!hours.enabled || !hours.hours) return []
    const spentOn = toLocalDate(new Date())
    // Redmine requires a comment on time entries: the first line of the handoff, or a generic one.
    const comments =
        comment
            .split('\n')
            .find((line) => line.trim())
            ?.trim()
            .slice(0, 255) || t('handoff.timeComment')
    const draft: TimeEntryDraft = { issueId, spentOn, hours: hours.hours, activityId: hours.activityId, comments }
    const steps: Step[] = [
        { key: `time:${issueId}:${hours.hours}`, run: async () => void (await logTime.mutateAsync(draft)) }
    ]
    // The stopwatch's time is now logged: keeping it would log it twice.
    if (hours.fromTimer) {
        steps.push({ key: `timer:${issueId}`, run: async () => void (await timerActions.discard.mutateAsync()) })
    }
    if (hours.overtime > 0) {
        const entry = { day: spentOn, hours: hours.overtime, issueId, note: comments }
        steps.push({
            key: `overtime:${issueId}:${hours.overtime}`,
            run: async () => void (await addOvertime.mutateAsync(entry))
        })
    }
    return steps
}

/** The comment (Markdown) and files of a handoff; files can be pasted anywhere in the field. */
export function CommentWithFiles({
    comment,
    onComment,
    files,
    attachments,
    placeholder
}: {
    comment: string
    onComment: (comment: string) => void
    files: ReturnType<typeof useChosenFiles>
    /** Attachments of the issue that gets the comment, for the preview. */
    attachments?: Attachment[]
    placeholder?: string
}) {
    const { t } = useI18n()
    const [previewIndex, setPreviewIndex] = useState<number | null>(null)
    return (
        <div className="flex flex-col gap-2" onPaste={files.handlePaste}>
            <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted">{t('handoff.comment')}</span>
                <MarkdownEditor
                    value={comment}
                    onChange={onComment}
                    files={files}
                    attachments={attachments}
                    placeholder={placeholder}
                    className="min-h-28"
                />
            </div>
            <AttachmentPicker
                files={files.files}
                onAdd={files.add}
                onRemove={files.remove}
                onPreview={setPreviewIndex}
            />
            {previewIndex !== null && (
                <UploadPreviewDialog
                    uploads={files.uploads}
                    index={previewIndex}
                    onIndexChange={setPreviewIndex}
                    onClose={() => setPreviewIndex(null)}
                />
            )}
        </div>
    )
}

export type ChosenFiles = ReturnType<typeof useChosenFiles>
export type { IssueUpload }
