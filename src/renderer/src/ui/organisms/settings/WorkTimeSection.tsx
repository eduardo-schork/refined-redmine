import { Plus, X } from 'lucide-react'
import type { WorkPeriod, WorkSchedule } from '@domain/time/business-hours'
import { useStatuses } from '@/hooks/reference'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { Input, Select } from '../../atoms/fields'
import { IconButton } from '../../atoms/IconButton'
import { Field } from '../../molecules/Field'
import { WeekdayPicker } from '../../molecules/pickers'
import { Card } from '../../molecules/surfaces'

const KEEP = ''
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

/** Status set when the stopwatch starts, and the working hours used by "count from" in the trâmites. */
export function WorkTimeSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const update = useUpdateSettings()
    const statuses = useStatuses().data ?? []
    const schedule = settings.workSchedule
    const saveSchedule = (patch: Partial<WorkSchedule>) => update.mutate({ workSchedule: { ...schedule, ...patch } })
    const changePeriod = (index: number, patch: Partial<WorkPeriod>) =>
        saveSchedule({
            periods: schedule.periods.map((period, position) => (position === index ? { ...period, ...patch } : period))
        })
    const removePeriod = (index: number) =>
        saveSchedule({ periods: schedule.periods.filter((_, position) => position !== index) })
    const addPeriod = () => saveSchedule({ periods: [...schedule.periods, { start: '19:00', end: '20:00' }] })

    return (
        <Card title={t('workTime.title')} description={t('workTime.description')}>
            <div className="flex flex-col gap-5">
                <Field label={t('workTime.timerStatus')} hint={t('workTime.timerStatusHint')}>
                    <Select
                        className="w-64"
                        value={settings.timerStartStatusId ?? KEEP}
                        onChange={(event) =>
                            update.mutate({ timerStartStatusId: Number(event.target.value) || undefined })
                        }
                    >
                        <option value={KEEP}>{t('workTime.keepStatus')}</option>
                        {statuses
                            .filter((status) => !status.is_closed)
                            .map((status) => (
                                <option key={status.id} value={status.id}>
                                    {status.name}
                                </option>
                            ))}
                    </Select>
                </Field>
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted">{t('workTime.schedule')}</span>
                    <WeekdayPicker
                        value={schedule.weekdays}
                        order={MONDAY_FIRST}
                        onChange={(weekdays) => saveSchedule({ weekdays })}
                    />
                    {schedule.periods.map((period, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                type="time"
                                className="w-32"
                                value={period.start}
                                onChange={(event) => changePeriod(index, { start: event.target.value })}
                            />
                            <span className="text-sm text-muted">{t('workTime.to')}</span>
                            <Input
                                type="time"
                                className="w-32"
                                value={period.end}
                                onChange={(event) => changePeriod(index, { end: event.target.value })}
                            />
                            <IconButton
                                size="sm"
                                label={t('workTime.removePeriod')}
                                icon={<X />}
                                onClick={() => removePeriod(index)}
                            />
                        </div>
                    ))}
                    <div>
                        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={addPeriod}>
                            <Plus size={13} /> {t('workTime.addPeriod')}
                        </Button>
                    </div>
                    <p className="text-xs text-muted">{t('workTime.scheduleHint')}</p>
                </div>
            </div>
        </Card>
    )
}
