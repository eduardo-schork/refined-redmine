import { availableEvents, type MonitorEvent, type MonitorSourceType } from '@domain/monitor/monitor'
import { useI18n } from '@/lib/i18n'
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

/** One switch per event the source can report. */
export function MonitorEventsFields({
    sourceType,
    events,
    onChange
}: {
    sourceType: MonitorSourceType
    events: Events
    onChange: (events: Events) => void
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
        </div>
    )
}
