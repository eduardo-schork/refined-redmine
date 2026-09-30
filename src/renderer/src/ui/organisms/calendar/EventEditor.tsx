import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bell, Clock, Link2, MapPin, Palette, Repeat, Text, Trash2 } from 'lucide-react'
import {
    ALLDAY_REMINDER_PRESETS,
    REMINDER_PRESETS,
    type CalendarEvent,
    type Recurrence,
    type RecurrenceFreq
} from '@domain/calendar/calendar-event'
import { eventBounds, nthWeekdayOf } from '@domain/calendar/recurrence'
import { addDays, addMinutes, parseLocal, toLocalDate, toLocalDateTime } from '@domain/shared/date'
import { describeRecurrence, onNth } from '@shared/i18n/format/recurrence'
import { useIssueTitle } from '@/hooks/issues'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { Input, Select, Textarea } from '../../atoms/fields'
import { Dialog } from '../../molecules/Dialog'
import { ToggleField } from '../../molecules/Field'
import { ColorPicker, ReminderPicker, WeekdayPicker } from '../../molecules/pickers'
import { Alert } from '../../molecules/surfaces'

type Preset =
    'none' | 'daily' | 'workdays' | 'weekly' | 'monthly-day' | 'monthly-nth' | 'monthly-last' | 'yearly' | 'custom'

const UNIT_KEYS = { daily: 'unitDay', weekly: 'unitWeek', monthly: 'unitMonth', yearly: 'unitYear' } as const
const WORKDAYS = [1, 2, 3, 4, 5]
const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0]
const WEEK_FROM_SUNDAY = [0, 1, 2, 3, 4, 5, 6]
const MS_PER_DAY = 86_400_000
const MAX_NTH_WEEKDAY = 4

function weeklyPreset(recurrence: Recurrence, start: Date): Preset {
    const weekdays = recurrence.byWeekday?.length ? recurrence.byWeekday : [start.getDay()]
    const normalized = weekdays.slice().sort().join()
    if (normalized === WORKDAYS.join()) return 'workdays'
    if (normalized === String(start.getDay())) return 'weekly'
    return 'custom'
}

function monthlyPreset(recurrence: Recurrence): Preset {
    if (recurrence.monthlyMode !== 'weekday') return 'monthly-day'
    if (recurrence.monthlyNth === -1) return 'monthly-last'
    return 'monthly-nth'
}

function presetOf(recurrence: Recurrence | undefined, start: Date): Preset {
    if (!recurrence) return 'none'
    const hasCustomInterval = (recurrence.interval ?? 1) !== 1
    if (hasCustomInterval || recurrence.until || recurrence.count) return 'custom'
    switch (recurrence.freq) {
        case 'daily':
            return 'daily'
        case 'weekly':
            return weeklyPreset(recurrence, start)
        case 'monthly':
            return monthlyPreset(recurrence)
        default:
            return 'yearly'
    }
}

function recurrenceFor(preset: Preset, start: Date, current?: Recurrence): Recurrence | undefined {
    switch (preset) {
        case 'none':
            return undefined
        case 'daily':
            return { freq: 'daily', interval: 1 }
        case 'workdays':
            return { freq: 'weekly', interval: 1, byWeekday: [...WORKDAYS] }
        case 'weekly':
            return { freq: 'weekly', interval: 1, byWeekday: [start.getDay()] }
        case 'monthly-day':
            return { freq: 'monthly', interval: 1, monthlyMode: 'day' }
        case 'monthly-nth':
            return {
                freq: 'monthly',
                interval: 1,
                monthlyMode: 'weekday',
                monthlyNth: Math.min(MAX_NTH_WEEKDAY, nthWeekdayOf(start).nth)
            }
        case 'monthly-last':
            return { freq: 'monthly', interval: 1, monthlyMode: 'weekday', monthlyNth: -1 }
        case 'yearly':
            return { freq: 'yearly', interval: 1 }
        case 'custom':
            return current ?? { freq: 'weekly', interval: 1, byWeekday: [start.getDay()] }
    }
}

function weekdaysForFrequency(recurrence: Recurrence, freq: RecurrenceFreq, start: Date): number[] | undefined {
    if (freq !== 'weekly') return undefined
    if (recurrence.byWeekday?.length) return recurrence.byWeekday
    return [start.getDay()]
}

function withFrequency(recurrence: Recurrence, freq: RecurrenceFreq, start: Date): Recurrence {
    return {
        ...recurrence,
        freq,
        byWeekday: weekdaysForFrequency(recurrence, freq, start),
        monthlyMode: freq === 'monthly' ? (recurrence.monthlyMode ?? 'day') : undefined
    }
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

function positiveInteger(value: string): number {
    return Math.max(1, Number(value) || 1)
}

function parseIssueId(input: string): number | undefined {
    return Number(input.replace('#', '')) || undefined
}

function fieldValues(draft: CalendarEvent, end: Date) {
    if (draft.allDay) {
        return {
            startDate: draft.start.slice(0, 10),
            startTime: '09:00',
            endDate: draft.end.slice(0, 10),
            endTime: '10:00'
        }
    }
    return {
        startDate: draft.start.slice(0, 10),
        startTime: draft.start.slice(11, 16),
        endDate: toLocalDate(end),
        endTime: toLocalDateTime(end).slice(11, 16)
    }
}

export function EventEditor({
    initial,
    isNew,
    onCancel,
    onSave,
    onDelete
}: {
    initial: CalendarEvent
    isNew: boolean
    onCancel: () => void
    onSave: (event: CalendarEvent) => void
    onDelete?: () => void
}) {
    const { t, dates } = useI18n()
    const calendarSettings = useSettings().calendar
    const [draft, setDraft] = useState<CalendarEvent>(initial)
    const [customOpen, setCustomOpen] = useState(
        () => presetOf(initial.recurrence, eventBounds(initial).start) === 'custom'
    )
    const [issueInput, setIssueInput] = useState(initial.issueId ? String(initial.issueId) : '')
    const [problem, setProblem] = useState<string | null>(null)
    const { start, end } = eventBounds(draft)
    const patch = (changes: Partial<CalendarEvent>) => setDraft((current) => ({ ...current, ...changes }))
    const preset = presetOf(draft.recurrence, start)
    const nth = nthWeekdayOf(start)
    const issueId = parseIssueId(issueInput)

    const { startDate, startTime, endDate, endTime } = fieldValues(draft, end)

    function moveStart(newStart: Date, duration: number) {
        patch({ start: toLocalDateTime(newStart), end: toLocalDateTime(new Date(newStart.getTime() + duration)) })
    }

    // Changing the start keeps the duration (like Google).
    function setStartDate(date: string) {
        if (!date) return
        const duration = end.getTime() - start.getTime()
        if (draft.allDay) {
            const dayCount = Math.round(duration / MS_PER_DAY)
            patch({ start: date, end: toLocalDate(addDays(parseLocal(date), dayCount - 1)) })
            return
        }
        moveStart(parseLocal(`${date}T${startTime}`), duration)
    }

    function setStartTime(time: string) {
        if (!time) return
        const duration = end.getTime() - start.getTime()
        moveStart(parseLocal(`${startDate}T${time}`), duration)
    }

    function setEnd(date: string, time: string) {
        if (!date) return
        if (draft.allDay) {
            patch({ end: date < startDate ? startDate : date })
            return
        }
        const requestedEnd = parseLocal(`${date}T${time}`)
        // An end at or before the start falls back to a 30-minute event.
        const newEnd = requestedEnd <= start ? addMinutes(start, 30) : requestedEnd
        patch({ end: toLocalDateTime(newEnd) })
    }

    function setAllDay(allDay: boolean) {
        if (allDay) {
            patch({
                allDay,
                start: startDate,
                end: endDate < startDate ? startDate : endDate,
                reminders: [...calendarSettings.defaultAllDayReminders]
            })
            return
        }
        const timedStart = parseLocal(`${startDate}T09:00`)
        patch({
            allDay,
            start: toLocalDateTime(timedStart),
            end: toLocalDateTime(addMinutes(timedStart, calendarSettings.defaultDuration)),
            reminders: [...calendarSettings.defaultReminders]
        })
    }

    function handlePresetChange(selectedPreset: Preset) {
        setCustomOpen(selectedPreset === 'custom')
        patch({
            recurrence: recurrenceFor(selectedPreset, start, draft.recurrence),
            exceptions: selectedPreset === 'none' ? undefined : draft.exceptions
        })
    }

    function save() {
        if (issueInput.trim() && !issueId) {
            setProblem(t('errors.calendar.invalidIssue'))
            return
        }
        if (!draft.title.trim()) {
            setProblem(t('errors.calendar.titleRequired'))
            return
        }
        onSave({ ...draft, title: draft.title.trim(), issueId })
    }

    useEffect(() => {
        const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
            const withModifier = keyboardEvent.metaKey || keyboardEvent.ctrlKey
            if (withModifier && keyboardEvent.key === 'Enter') save()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    })

    const presets = useMemo(() => {
        const standardPresets: Preset[] = ['none', 'daily', 'workdays', 'weekly', 'monthly-day']
        if (nth.nth <= MAX_NTH_WEEKDAY) standardPresets.push('monthly-nth')
        if (nth.isLast) standardPresets.push('monthly-last')
        standardPresets.push('yearly')
        const options = standardPresets.map((option) => {
            const label = describeRecurrence(recurrenceFor(option, start), start, t, dates)
            return [option, label] as const
        })
        const customLabel =
            preset === 'custom'
                ? t('recurrence.custom', { text: describeRecurrence(draft.recurrence, start, t, dates) })
                : t('recurrence.customize')
        return [...options, ['custom', customLabel] as const]
    }, [nth.nth, nth.isLast, start, t, dates, preset, draft.recurrence])

    const recurrence = draft.recurrence
    const weekOrder = calendarSettings.weekStartsOn === 1 ? WEEK_FROM_MONDAY : WEEK_FROM_SUNDAY

    return (
        <Dialog
            size="lg"
            title={isNew ? t('calendar.editor.newTitle') : t('calendar.editor.editTitle')}
            onClose={onCancel}
            footer={
                <>
                    {onDelete && (
                        <Button variant="danger" className="mr-auto" onClick={onDelete}>
                            <Trash2 size={14} /> {t('common.delete')}
                        </Button>
                    )}
                    <Button onClick={onCancel}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={save} title={t('calendar.editor.saveShortcut')}>
                        {t('common.save')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <input
                    autoFocus
                    value={draft.title}
                    onChange={(event) => patch({ title: event.target.value })}
                    placeholder={t('calendar.editor.titlePlaceholder')}
                    className="w-full border-b-2 border-line bg-transparent pb-1.5 text-2xl outline-none focus:border-accent"
                />
                {problem && <Alert className="px-3 py-2">{problem}</Alert>}

                <Row icon={<Clock size={16} />}>
                    <DateTimeFields
                        allDay={draft.allDay}
                        startDate={startDate}
                        startTime={startTime}
                        endDate={endDate}
                        endTime={endTime}
                        onStartDate={setStartDate}
                        onStartTime={setStartTime}
                        onEnd={setEnd}
                        onAllDay={setAllDay}
                    />
                </Row>

                <Row icon={<Repeat size={16} />}>
                    <Select
                        className="max-w-md"
                        value={preset}
                        onChange={(event) => handlePresetChange(event.target.value as Preset)}
                    >
                        {presets.map(([option, label]) => (
                            <option key={option} value={option}>
                                {label}
                            </option>
                        ))}
                    </Select>
                    {customOpen && recurrence && (
                        <CustomRecurrence
                            recurrence={recurrence}
                            start={start}
                            weekOrder={weekOrder}
                            onChange={(changed) => patch({ recurrence: changed })}
                        />
                    )}
                </Row>

                <Row icon={<Bell size={16} />}>
                    <ReminderPicker
                        value={draft.reminders}
                        presets={draft.allDay ? ALLDAY_REMINDER_PRESETS : REMINDER_PRESETS}
                        allDay={draft.allDay}
                        allDayHour={calendarSettings.allDayReminderHour}
                        allowCustom
                        onChange={(reminders) => patch({ reminders })}
                    />
                </Row>

                <Row icon={<Palette size={16} />}>
                    <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
                </Row>

                <Row icon={<MapPin size={16} />}>
                    <Input
                        value={draft.location ?? ''}
                        placeholder={t('calendar.editor.locationPlaceholder')}
                        onChange={(event) => patch({ location: event.target.value || undefined })}
                    />
                </Row>

                <Row icon={<Link2 size={16} />}>
                    <IssueLinkField value={issueInput} issueId={issueId} onChange={setIssueInput} />
                </Row>

                <Row icon={<Text size={16} />}>
                    <Textarea
                        value={draft.description ?? ''}
                        onChange={(event) => patch({ description: event.target.value || undefined })}
                        placeholder={t('calendar.editor.descriptionPlaceholder')}
                    />
                </Row>
            </div>
        </Dialog>
    )
}

function DateTimeFields({
    allDay,
    startDate,
    startTime,
    endDate,
    endTime,
    onStartDate,
    onStartTime,
    onEnd,
    onAllDay
}: {
    allDay: boolean
    startDate: string
    startTime: string
    endDate: string
    endTime: string
    onStartDate: (date: string) => void
    onStartTime: (time: string) => void
    onEnd: (date: string, time: string) => void
    onAllDay: (allDay: boolean) => void
}) {
    const { t } = useI18n()
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                type="date"
                className="w-40"
                value={startDate}
                onChange={(event) => onStartDate(event.target.value)}
            />
            {!allDay && (
                <Input
                    type="time"
                    className="w-28"
                    value={startTime}
                    onChange={(event) => onStartTime(event.target.value)}
                />
            )}
            <span className="text-muted">{t('calendar.editor.until')}</span>
            {!allDay && (
                <Input
                    type="time"
                    className="w-28"
                    value={endTime}
                    onChange={(event) => onEnd(endDate, event.target.value)}
                />
            )}
            <Input
                type="date"
                className="w-40"
                value={endDate}
                onChange={(event) => onEnd(event.target.value, endTime)}
            />
            <div className="w-36">
                <ToggleField checked={allDay} onChange={onAllDay} label={t('calendar.allDay')} />
            </div>
        </div>
    )
}

function CustomRecurrence({
    recurrence,
    start,
    weekOrder,
    onChange
}: {
    recurrence: Recurrence
    start: Date
    weekOrder: number[]
    onChange: (recurrence: Recurrence) => void
}) {
    const { t, dates } = useI18n()
    const frequencies = Object.keys(UNIT_KEYS) as RecurrenceFreq[]

    function handleWeekdaysChange(weekdays: number[]) {
        const byWeekday = weekdays.length ? weekdays : [start.getDay()]
        onChange({ ...recurrence, byWeekday })
    }

    return (
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-line bg-panel-2/50 p-3 text-sm">
            <div className="flex items-center gap-2">
                {t('calendar.editor.repeatEvery')}
                <Input
                    type="number"
                    min={1}
                    className="w-16"
                    value={recurrence.interval}
                    onChange={(event) => onChange({ ...recurrence, interval: positiveInteger(event.target.value) })}
                />
                <Select
                    className="w-32"
                    value={recurrence.freq}
                    onChange={(event) =>
                        onChange(withFrequency(recurrence, event.target.value as RecurrenceFreq, start))
                    }
                >
                    {frequencies.map((frequency) => (
                        <option key={frequency} value={frequency}>
                            {t(`calendar.editor.${UNIT_KEYS[frequency]}`, { count: recurrence.interval })}
                        </option>
                    ))}
                </Select>
            </div>

            {recurrence.freq === 'weekly' && (
                <div className="flex items-center gap-2">
                    {t('calendar.editor.repeatOn')}
                    <WeekdayPicker
                        order={weekOrder}
                        value={recurrence.byWeekday ?? []}
                        onChange={handleWeekdaysChange}
                    />
                </div>
            )}

            {recurrence.freq === 'monthly' && (
                <MonthlyModeSelect recurrence={recurrence} start={start} onChange={onChange} />
            )}

            <RecurrenceEnds recurrence={recurrence} start={start} onChange={onChange} />
            <div className="text-xs text-muted">{describeRecurrence(recurrence, start, t, dates)}</div>
        </div>
    )
}

function MonthlyModeSelect({
    recurrence,
    start,
    onChange
}: {
    recurrence: Recurrence
    start: Date
    onChange: (recurrence: Recurrence) => void
}) {
    const { t, dates } = useI18n()
    const nth = nthWeekdayOf(start)
    const weekday = start.getDay()
    const selectedValue = recurrence.monthlyMode === 'weekday' ? String(recurrence.monthlyNth ?? nth.nth) : 'day'

    function handleChange(value: string) {
        if (value === 'day') {
            onChange({ ...recurrence, monthlyMode: 'day', monthlyNth: undefined })
            return
        }
        onChange({ ...recurrence, monthlyMode: 'weekday', monthlyNth: Number(value) })
    }

    return (
        <Select className="max-w-sm" value={selectedValue} onChange={(event) => handleChange(event.target.value)}>
            <option value="day">{capitalize(t('recurrence.onDay', { day: start.getDate() }))}</option>
            {nth.nth <= MAX_NTH_WEEKDAY && (
                <option value={nth.nth}>{capitalize(onNth(nth.nth, weekday, t, dates))}</option>
            )}
            {nth.isLast && <option value="-1">{capitalize(onNth(-1, weekday, t, dates))}</option>}
        </Select>
    )
}

function RecurrenceEnds({
    recurrence,
    start,
    onChange
}: {
    recurrence: Recurrence
    start: Date
    onChange: (recurrence: Recurrence) => void
}) {
    const { t } = useI18n()
    const endsNever = !recurrence.until && !recurrence.count

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{t('calendar.editor.ends')}</span>
            <label className="flex items-center gap-2">
                <input
                    type="radio"
                    checked={endsNever}
                    onChange={() => onChange({ ...recurrence, until: undefined, count: undefined })}
                />{' '}
                {t('calendar.editor.never')}
            </label>
            <label className="flex items-center gap-2">
                <input
                    type="radio"
                    checked={Boolean(recurrence.until)}
                    onChange={() =>
                        onChange({ ...recurrence, count: undefined, until: toLocalDate(addDays(start, 30)) })
                    }
                />{' '}
                {t('calendar.editor.on')}
                <Input
                    type="date"
                    className="w-40"
                    disabled={!recurrence.until}
                    value={recurrence.until ?? ''}
                    onChange={(event) => onChange({ ...recurrence, until: event.target.value || undefined })}
                />
            </label>
            <label className="flex items-center gap-2">
                <input
                    type="radio"
                    checked={Boolean(recurrence.count)}
                    onChange={() => onChange({ ...recurrence, until: undefined, count: 10 })}
                />{' '}
                {t('calendar.editor.after')}
                <Input
                    type="number"
                    min={1}
                    className="w-20"
                    disabled={!recurrence.count}
                    value={recurrence.count ?? ''}
                    onChange={(event) => onChange({ ...recurrence, count: positiveInteger(event.target.value) })}
                />
                {t('calendar.editor.occurrences')}
            </label>
        </div>
    )
}

function IssueLinkField({
    value,
    issueId,
    onChange
}: {
    value: string
    issueId: number | undefined
    onChange: (value: string) => void
}) {
    const { t } = useI18n()
    const linked = useIssueTitle(issueId)

    function hint(): string {
        if (!issueId) return t('calendar.editor.issueHint')
        if (linked.isLoading) return t('calendar.editor.issueSearching')
        if (linked.data) return `${linked.data.tracker.name} · ${linked.data.subject}`
        return t('calendar.editor.issueNotFound')
    }

    return (
        <div className="flex items-center gap-2">
            <Input
                className="w-32"
                value={value}
                placeholder={t('calendar.editor.issuePlaceholder')}
                onChange={(event) => onChange(event.target.value)}
            />
            <span className="truncate text-xs text-muted">{hint()}</span>
        </div>
    )
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-2 text-muted">{icon}</span>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    )
}
