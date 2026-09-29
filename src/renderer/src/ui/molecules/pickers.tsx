import { useState, type ChangeEvent } from 'react'
import { Check } from 'lucide-react'
import { EVENT_COLORS } from '@domain/calendar/colors'
import type { EventColor } from '@domain/calendar/calendar-event'
import { describeReminder } from '@shared/i18n/format/recurrence'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { AddSelect, Input, Select } from '../atoms/fields'
import { IconButton } from '../atoms/IconButton'
import { RemovableChip } from './RemovableChip'

const MINUTE = 1
const HOUR = 60
const DAY = 1440
const WEEK = 10080

type CustomReminder = { value: number; unit: number }

const ascending = (first: number, second: number) => first - second

// Timed events default to "20 minutes before"; all-day events have no minutes/hours, so they default to "2 days before".
const defaultCustomReminder = (allDay: boolean): CustomReminder =>
    allDay ? { value: 2, unit: DAY } : { value: 20, unit: MINUTE }

/** Reminder list with presets and a custom value. */
export function ReminderPicker({
    value,
    presets,
    allDay,
    allDayHour,
    allowCustom,
    onChange
}: {
    value: number[]
    presets: number[]
    allDay: boolean
    allDayHour: number
    allowCustom?: boolean
    onChange: (reminders: number[]) => void
}) {
    const { t } = useI18n()
    const [custom, setCustom] = useState<CustomReminder | null>(null)
    const add = (minutes: number) => onChange([...new Set([...value, minutes])].sort(ascending))
    const remove = (minutes: number) => onChange(value.filter((reminder) => reminder !== minutes))
    const label = (minutes: number) => describeReminder(minutes, allDay, allDayHour, t)
    const availablePresets = presets.filter((minutes) => !value.includes(minutes))

    const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const selected = event.target.value
        if (selected === 'custom') {
            setCustom(defaultCustomReminder(allDay))
            return
        }
        add(Number(selected))
    }

    const confirmCustom = (reminder: CustomReminder) => {
        add(reminder.value * reminder.unit)
        setCustom(null)
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {value.map((minutes) => (
                <RemovableChip key={minutes} onRemove={() => remove(minutes)}>
                    {label(minutes)}
                </RemovableChip>
            ))}
            {custom ? (
                <CustomReminderEditor
                    custom={custom}
                    allDay={allDay}
                    onChange={setCustom}
                    onConfirm={() => confirmCustom(custom)}
                />
            ) : (
                <AddSelect onChange={handlePresetChange}>
                    <option value="">{t('calendar.editor.addReminder')}</option>
                    {availablePresets.map((minutes) => (
                        <option key={minutes} value={minutes}>
                            {label(minutes)}
                        </option>
                    ))}
                    {allowCustom && <option value="custom">{t('calendar.editor.customReminder')}</option>}
                </AddSelect>
            )}
        </div>
    )
}

function CustomReminderEditor({
    custom,
    allDay,
    onChange,
    onConfirm
}: {
    custom: CustomReminder
    allDay: boolean
    onChange: (custom: CustomReminder) => void
    onConfirm: () => void
}) {
    const { t } = useI18n()
    const handleValueChange = (event: ChangeEvent<HTMLInputElement>) => {
        const amount = Math.max(1, Number(event.target.value) || 1)
        onChange({ ...custom, value: amount })
    }
    const handleUnitChange = (event: ChangeEvent<HTMLSelectElement>) => {
        onChange({ ...custom, unit: Number(event.target.value) })
    }
    return (
        <span className="inline-flex items-center gap-1">
            <Input type="number" min={1} className="h-7 w-16" value={custom.value} onChange={handleValueChange} />
            <Select className="h-7 w-28" value={custom.unit} onChange={handleUnitChange}>
                {!allDay && <option value={MINUTE}>{t('calendar.editor.minutes')}</option>}
                {!allDay && <option value={HOUR}>{t('calendar.editor.hours')}</option>}
                <option value={DAY}>{t('calendar.editor.days')}</option>
                <option value={WEEK}>{t('calendar.editor.weeks')}</option>
            </Select>
            <IconButton label={t('common.add')} icon={<Check size={14} />} className="h-7 w-7" onClick={onConfirm} />
        </span>
    )
}

export function ColorPicker({ value, onChange }: { value: EventColor; onChange: (color: EventColor) => void }) {
    const { t } = useI18n()
    return (
        <div className="flex flex-wrap gap-1.5">
            {EVENT_COLORS.map((color) => {
                const isSelected = value === color.key
                const checkColor = color.darkText ? 'text-black' : 'text-white'
                return (
                    <button
                        key={color.key}
                        type="button"
                        title={t(`calendar.colors.${color.key}`)}
                        aria-pressed={isSelected}
                        onClick={() => onChange(color.key)}
                        className="flex h-6 w-6 cursor-default items-center justify-center rounded-full"
                        style={{ background: color.hex }}
                    >
                        {isSelected && <Check size={13} className={checkColor} />}
                    </button>
                )
            })}
        </div>
    )
}

type WeekdayVariant = 'round' | 'pill'

const WEEKDAY_STYLES: Record<WeekdayVariant, { shape: string; selected: string; unselected: string }> = {
    round: {
        shape: 'h-7 w-7 rounded-full font-medium',
        selected: 'bg-accent text-on-accent',
        unselected: 'border border-line bg-panel text-muted'
    },
    pill: {
        shape: 'h-7 w-10 rounded-md border capitalize',
        selected: 'border-accent bg-accent-soft text-accent',
        unselected: 'border-line text-muted'
    }
}

/** Weekdays. `days` uses 0 = Sunday … 6 = Saturday; `order` sets the display order. */
export function WeekdayPicker({
    value,
    onChange,
    order = [0, 1, 2, 3, 4, 5, 6],
    variant = 'round'
}: {
    value: number[]
    onChange: (weekdays: number[]) => void
    order?: number[]
    variant?: WeekdayVariant
}) {
    const { dates } = useI18n()
    const styles = WEEKDAY_STYLES[variant]
    const toggle = (weekday: number) => {
        if (value.includes(weekday)) {
            onChange(value.filter((selected) => selected !== weekday))
            return
        }
        onChange([...value, weekday].sort(ascending))
    }
    return (
        <div className="flex gap-1">
            {order.map((weekday) => {
                const isSelected = value.includes(weekday)
                const shortName = dates.weekdayShort(weekday)
                const text = variant === 'round' ? shortName[0].toUpperCase() : shortName
                return (
                    <button
                        key={weekday}
                        type="button"
                        title={dates.weekdayLong(weekday)}
                        aria-pressed={isSelected}
                        onClick={() => toggle(weekday)}
                        className={cn(
                            'cursor-default text-xs',
                            styles.shape,
                            isSelected ? styles.selected : styles.unselected
                        )}
                    >
                        {text}
                    </button>
                )
            })}
        </div>
    )
}

export function HourSelect({ value, onChange }: { value: number; onChange: (hour: number) => void }) {
    const { t } = useI18n()
    return (
        <Select className="w-20" value={value} onChange={(event) => onChange(Number(event.target.value))}>
            {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                    {t('settings.hour', { hour: String(hour).padStart(2, '0') })}
                </option>
            ))}
        </Select>
    )
}
