import { useState } from 'react'
import type { HandoffRule } from '@domain/automation/handoff'
import { toLocalDate } from '@domain/shared/date'
import { defaultActivityId, parseHours, type TimeEntryDraft } from '@domain/time/time-entry'
import type { IssueUpload } from '@domain/redmine/issue-upload'
import { useAddOvertime } from '@/hooks/overtime'
import { useLogTime, useTimeActivities } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { lastActivityId } from '@/lib/last-activity'
import type { Step } from '@/lib/steps'
import { Input, Select, Textarea } from '../../atoms/fields'
import { AttachmentPicker } from '../../molecules/AttachmentPicker'
import { Field } from '../../molecules/Field'
import { UploadPreviewDialog } from '../attachments/UploadPreviewDialog'
import { type useChosenFiles } from '../IssueCreateDialog'

/**
 * Hours logged with a handoff: empty means nothing is logged. Typed hours that cannot be read, or an overtime part
 * larger than the hours, block sending. The overtime part also goes to the app's overtime bank.
 */
export function useHandoffHours(rule: HandoffRule) {
    const activities = useTimeActivities().data ?? []
    const [typedHours, setTypedHours] = useState('')
    const [typedOvertime, setTypedOvertime] = useState('')
    const [chosenActivity, setChosenActivity] = useState<number | undefined>(rule.timeActivityId)
    const hours = typedHours.trim() ? parseHours(typedHours) : undefined
    const overtime = typedOvertime.trim() ? parseHours(typedOvertime) : 0
    const activityId = chosenActivity ?? defaultActivityId(activities, lastActivityId())
    const unreadable = hours === null || overtime === null
    const overtimeTooLarge = hours != null && overtime != null && overtime > hours
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
        blocked: rule.logTime && (unreadable || overtimeTooLarge)
    }
}

export type HandoffHours = ReturnType<typeof useHandoffHours>

export function HoursFields({ hours }: { hours: HandoffHours }) {
    const { t } = useI18n()
    if (!hours.enabled) return null
    return (
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
    )
}

/** The time entry (and overtime) steps of a handoff, logged today on `issueId`. */
export function useTimeSteps(hours: HandoffHours, issueId: number, comment: string): Step[] {
    const { t } = useI18n()
    const logTime = useLogTime()
    const addOvertime = useAddOvertime()
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
    placeholder
}: {
    comment: string
    onComment: (comment: string) => void
    files: ReturnType<typeof useChosenFiles>
    placeholder?: string
}) {
    const { t } = useI18n()
    const [previewIndex, setPreviewIndex] = useState<number | null>(null)
    return (
        <div className="flex flex-col gap-2" onPaste={files.handlePaste}>
            <Field label={t('handoff.comment')} hint={t('issue.create.markdownHint')}>
                <Textarea
                    className="min-h-24 font-mono text-xs"
                    placeholder={placeholder}
                    value={comment}
                    onChange={(event) => onComment(event.target.value)}
                />
            </Field>
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
