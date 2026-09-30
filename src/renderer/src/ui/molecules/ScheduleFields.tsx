import type { Schedule } from '@domain/monitor/schedule'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { ToggleField } from './Field'
import { HourSelect, WeekdayPicker } from './pickers'

const PICKER_SUNDAY = 0
const DOMAIN_SUNDAY = 7

// The domain uses 1 = Monday … 7 = Sunday; the picker uses 0 = Sunday.
const domainDayToPicker = (day: number) => day % 7
const pickerDayToDomain = (day: number) => (day === PICKER_SUNDAY ? DOMAIN_SUNDAY : day)

export const DEFAULT_SCHEDULE: Schedule = { enabled: true, weekdays: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 }

/** Switch + weekdays + start/end hour. */
export function ScheduleFields({
    schedule,
    label,
    description,
    onChange
}: {
    schedule: Schedule
    label: string
    description?: string
    onChange: (schedule: Schedule) => void
}) {
    const { t } = useI18n()
    const pickerDays = schedule.weekdays.map(domainDayToPicker)

    const changeWeekdays = (pickedDays: number[]) => {
        const weekdays = pickedDays.map(pickerDayToDomain).sort((left, right) => left - right)
        onChange({ ...schedule, weekdays })
    }

    return (
        <div>
            <ToggleField
                checked={schedule.enabled}
                onChange={(enabled) => onChange({ ...schedule, enabled })}
                label={label}
                description={description}
            />
            <div
                className={cn(
                    'mt-3 flex flex-wrap items-center gap-4',
                    !schedule.enabled && 'pointer-events-none opacity-40'
                )}
            >
                <WeekdayPicker
                    variant="pill"
                    order={[1, 2, 3, 4, 5, 6, 0]}
                    value={pickerDays}
                    onChange={changeWeekdays}
                />
                <div className="flex items-center gap-2 text-sm">
                    {t('settings.from')}
                    <HourSelect
                        value={schedule.startHour}
                        onChange={(startHour) => onChange({ ...schedule, startHour })}
                    />
                    {t('settings.to')}
                    <HourSelect value={schedule.endHour} onChange={(endHour) => onChange({ ...schedule, endHour })} />
                </div>
            </div>
        </div>
    )
}
