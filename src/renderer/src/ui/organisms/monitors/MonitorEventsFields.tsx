import {
    availableEvents,
    type CountRule,
    type MonitorEvent,
    type MonitorSourceType,
    type RelatedStatusRule
} from '@domain/monitor/monitor'
import { useStatuses, useTrackers } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { Input, Select } from '../../atoms/fields'
import { ToggleField } from '../../molecules/Field'
import { ChipChoice } from '../settings/HandoffRuleEditor'

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
// Starts without a tracker or status: saving asks for them.
const EMPTY_RELATED: RelatedStatusRule = { trackerId: 0, statusIds: [] }

/**
 * One switch per event the source can report. With `onCountChange` (query, filter and board monitors) the alert by
 * number of issues is one more switch of the same list, with its limit right below it when on; `onRelatedChange`
 * does the same for the related issue that reaches a status.
 */
export function MonitorEventsFields({
    sourceType,
    events,
    onChange,
    count,
    onCountChange,
    related,
    onRelatedChange
}: {
    sourceType: MonitorSourceType
    events: Events
    onChange: (events: Events) => void
    count?: CountRule
    onCountChange?: (count?: CountRule) => void
    related?: RelatedStatusRule
    onRelatedChange?: (related?: RelatedStatusRule) => void
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
            {onRelatedChange && (
                <div className="col-span-2">
                    <ToggleField
                        checked={Boolean(related)}
                        onChange={(enabled) => onRelatedChange(enabled ? EMPTY_RELATED : undefined)}
                        label={t('monitors.related.title')}
                        description={t('monitors.related.hint')}
                    />
                    {related && <RelatedRuleFields rule={related} onChange={onRelatedChange} />}
                </div>
            )}
        </div>
    )
}

/** Tracker of the related issue and the statuses that notify, under the switch. */
function RelatedRuleFields({
    rule,
    onChange
}: {
    rule: RelatedStatusRule
    onChange: (rule: RelatedStatusRule) => void
}) {
    const { t } = useI18n()
    const trackers = useTrackers().data ?? []
    const statuses = useStatuses().data ?? []
    return (
        <div className="flex flex-col gap-2 pb-2 pl-12">
            <Select
                className="w-64"
                aria-label={t('monitors.related.tracker')}
                value={rule.trackerId || ''}
                onChange={(event) => onChange({ ...rule, trackerId: Number(event.target.value) })}
            >
                <option value="" disabled>
                    {t('monitors.related.chooseTracker')}
                </option>
                {trackers.map((tracker) => (
                    <option key={tracker.id} value={tracker.id}>
                        {tracker.name}
                    </option>
                ))}
            </Select>
            <span className="text-xs text-muted">{t('monitors.related.statuses')}</span>
            <ChipChoice
                options={statuses}
                chosen={rule.statusIds}
                onChange={(statusIds) => onChange({ ...rule, statusIds })}
            />
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
