import { availableEvents, type CountRule, type MonitorEvent, type MonitorSourceType } from '@domain/monitor/monitor'
import { useI18n } from '@/lib/i18n'
import { Input, Select } from '../../atoms/fields'
import { ToggleField } from '../../molecules/Field'

type Events = Record<MonitorEvent, boolean>

function useEventHint(sourceType: MonitorSourceType) {
    const { t } = useI18n()
    return (event: MonitorEvent) => {
        if (sourceType === 'mine' && event === 'left') return t('monitors.mineLeftHint')
        if (sourceType === 'board' && event === 'status') return t('monitors.boardStatusHint')
        return t(`monitors.eventHint.${event}`)
    }
}

const DEFAULT_COUNT: CountRule = { op: 'below', value: 2 }

/**
 * One switch per event the source can report. With `onCountChange` (query, filter and board monitors) the alert by
 * number of issues is one more switch of the same list, with its limit right below it when on.
 */
export function MonitorEventsFields({
    sourceType,
    events,
    onChange,
    count,
    onCountChange
}: {
    sourceType: MonitorSourceType
    events: Events
    onChange: (events: Events) => void
    count?: CountRule
    onCountChange?: (count?: CountRule) => void
}) {
    const { t } = useI18n()
    const hintOf = useEventHint(sourceType)
    return (
        <div className="grid grid-cols-2 gap-x-6">
            {availableEvents(sourceType).map((event) => (
                <ToggleField
                    key={event}
                    checked={events[event]}
                    onChange={(enabled) => onChange({ ...events, [event]: enabled })}
                    label={t(`monitors.event.${event}`)}
                    description={hintOf(event)}
                />
            ))}
            {onCountChange && (
                <div>
                    <ToggleField
                        checked={Boolean(count)}
                        onChange={(enabled) => onCountChange(enabled ? DEFAULT_COUNT : undefined)}
                        label={t('monitors.count.title')}
                        description={t('monitors.count.hint')}
                    />
                    {count && <CountLimit count={count} onChange={onCountChange} />}
                </div>
            )}
        </div>
    )
}

/** "Fewer than [2] issues" under the switch. */
function CountLimit({ count, onChange }: { count: CountRule; onChange: (count: CountRule) => void }) {
    const { t } = useI18n()
    return (
        <div className="flex items-center gap-2 pb-2 pl-12">
            <Select
                className="w-32"
                value={count.op}
                onChange={(event) => onChange({ ...count, op: event.target.value as CountRule['op'] })}
            >
                <option value="below">{t('monitors.count.below')}</option>
                <option value="above">{t('monitors.count.above')}</option>
            </Select>
            <Input
                type="number"
                min={count.op === 'below' ? 1 : 0}
                step={1}
                className="w-20"
                value={count.value}
                onChange={(event) => onChange({ ...count, value: Number(event.target.value) })}
            />
            <span className="text-sm text-muted">{t('monitors.count.issues')}</span>
        </div>
    )
}
