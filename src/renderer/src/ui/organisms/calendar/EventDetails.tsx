import { useState, type ReactNode } from 'react'
import { Bell, Copy, ExternalLink, Link2, MapPin, Pencil, Repeat, Text, Trash2, X } from 'lucide-react'
import type { CalendarEvent, EditScope } from '@domain/calendar/calendar-event'
import { RedmineLinks, isHttpUrl } from '@domain/redmine/links'
import { parseLocal } from '@domain/shared/date'
import { describeRecurrence, describeReminder } from '@shared/i18n/format/recurrence'
import type { DisplayItem } from '@/hooks/calendar'
import { useSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { TextLink } from '../../atoms/misc'
import { Dialog } from '../../molecules/Dialog'
import { useOpenIssue } from '../IssueModal'

type SprintItem = Extract<DisplayItem, { kind: 'sprint' }>
type TaskItem = Extract<DisplayItem, { kind: 'task' }>

const SCOPE_OPTIONS: EditScope[] = ['this', 'following', 'all']

export function ScopeDialog({
    action,
    onPick,
    onClose
}: {
    action: 'edit' | 'delete'
    onPick: (scope: EditScope) => void
    onClose: () => void
}) {
    const { t } = useI18n()
    const [scope, setScope] = useState<EditScope>('this')
    const isDelete = action === 'delete'
    return (
        <Dialog
            title={isDelete ? t('calendar.scope.deleteTitle') : t('calendar.scope.editTitle')}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button variant={isDelete ? 'danger' : 'primary'} onClick={() => onPick(scope)}>
                        {t('common.ok')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-2 text-[13px]">
                {SCOPE_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2">
                        <input type="radio" checked={scope === option} onChange={() => setScope(option)} />{' '}
                        {t(`calendar.scope.${option}`)}
                    </label>
                ))}
            </div>
        </Dialog>
    )
}

export function EventDetails({
    item,
    onClose,
    onEdit,
    onDuplicate,
    onDelete,
    onGoSprints
}: {
    item: DisplayItem
    onClose: () => void
    onEdit: () => void
    onDuplicate: () => void
    onDelete: () => void
    onGoSprints: () => void
}) {
    const { t, dates } = useI18n()
    const event = item.kind === 'event' ? item.occurrence.event : undefined
    const dayLabel = dates.format(item.start, { weekday: 'long', day: 'numeric', month: 'long' })
    const timeLabel = dates.range(item.start, item.end, item.allDay, t('calendar.allDay'))

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/25 p-6" onMouseDown={onClose}>
            <div
                className="w-full max-w-md rounded-xl border border-line bg-panel shadow-2xl"
                onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
            >
                <div className="flex justify-end gap-0.5 px-2 pt-2">
                    {event && (
                        <>
                            <IconButton label={t('common.edit')} icon={<Pencil size={15} />} onClick={onEdit} />
                            <IconButton
                                label={t('calendar.details.duplicate')}
                                icon={<Copy size={15} />}
                                onClick={onDuplicate}
                            />
                            <IconButton label={t('common.delete')} icon={<Trash2 size={15} />} onClick={onDelete} />
                        </>
                    )}
                    <IconButton label={t('common.close')} icon={<X size={16} />} onClick={onClose} />
                </div>
                <div className="flex flex-col gap-3 px-5 pb-5 text-[13px]">
                    <div className="flex gap-3">
                        <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded" style={{ background: item.hex }} />
                        <div>
                            <div className="select-text text-[18px] leading-snug">{item.title}</div>
                            <div className="text-muted">
                                {dayLabel} · {timeLabel}
                            </div>
                        </div>
                    </div>

                    {event?.recurrence && (
                        <Line icon={<Repeat size={15} />}>
                            {describeRecurrence(event.recurrence, parseLocal(event.start), t, dates)}
                        </Line>
                    )}
                    {item.location && <LocationLine location={item.location} />}
                    {event && <EventExtraLines event={event} />}

                    {item.kind === 'sprint' && <SprintDetails item={item} onGoSprints={onGoSprints} />}
                    {item.kind === 'task' && <TaskActions item={item} />}
                </div>
            </div>
        </div>
    )
}

function LocationLine({ location }: { location: string }) {
    const content = isHttpUrl(location) ? (
        <TextLink onClick={() => void api.app.openExternal(location)}>{location}</TextLink>
    ) : (
        location
    )
    return <Line icon={<MapPin size={15} />}>{content}</Line>
}

function EventExtraLines({ event }: { event: CalendarEvent }) {
    const { t } = useI18n()
    const settings = useSettings()
    const openIssue = useOpenIssue()
    const allDayHour = settings.calendar.allDayReminderHour
    const remindersText = event.reminders
        .map((minutes) => describeReminder(minutes, event.allDay, allDayHour, t))
        .join(', ')
    const issueId = event.issueId

    return (
        <>
            {event.description && (
                <Line icon={<Text size={15} />}>
                    <span className="select-text whitespace-pre-wrap">{event.description}</span>
                </Line>
            )}
            {event.reminders.length > 0 && <Line icon={<Bell size={15} />}>{remindersText}</Line>}
            {issueId && (
                <Line icon={<Link2 size={15} />}>
                    <TextLink onClick={() => openIssue(issueId)}>
                        {t('calendar.details.task', { id: issueId })}
                    </TextLink>
                </Line>
            )}
        </>
    )
}

function SprintDetails({ item, onGoSprints }: { item: SprintItem; onGoSprints: () => void }) {
    const { t, dates } = useI18n()
    const sprint = item.sprint
    return (
        <>
            <Line icon={<Repeat size={15} />}>
                {t('calendar.details.sprintLine', {
                    name: sprint.version.name,
                    phase: t(`sprint.phase.${sprint.phase}`)
                })}
            </Line>
            <div className="text-xs text-muted">
                {t('sprints.datesLine', {
                    dev: dates.date(sprint.devDeadline, true),
                    release: dates.date(sprint.release, true)
                })}
            </div>
            <div>
                <Button onClick={onGoSprints}>{t('calendar.details.seeSprints')}</Button>
            </div>
        </>
    )
}

function TaskActions({ item }: { item: TaskItem }) {
    const { t } = useI18n()
    const settings = useSettings()
    const openIssue = useOpenIssue()
    const issueId = item.issue.id

    function openInRedmine() {
        const url = new RedmineLinks(settings.baseUrl).issue(issueId)
        void api.app.openExternal(url)
    }

    return (
        <div className="flex gap-2">
            <Button variant="primary" onClick={() => openIssue(issueId)}>
                {t('calendar.details.openTask')}
            </Button>
            <Button onClick={openInRedmine}>
                <ExternalLink size={14} /> {t('calendar.details.redmine')}
            </Button>
        </div>
    )
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
            <div className="min-w-0">{children}</div>
        </div>
    )
}
