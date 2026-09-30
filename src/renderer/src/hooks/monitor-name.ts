import { useCallback } from 'react'
import { MINE_MONITOR_ID } from '@domain/monitor/monitor'
import { useI18n } from '@/lib/i18n'
import { useSettings } from './session'

/** Display name of a monitor by id ("my issues" is translated; deleted monitors show the id). */
export function useMonitorName() {
    const { t } = useI18n()
    const monitors = useSettings().monitors
    return useCallback(
        (monitorId: string) => {
            if (monitorId === MINE_MONITOR_ID) return t('monitors.mine')
            const monitor = monitors.find((candidate) => candidate.id === monitorId)
            return monitor?.name || monitorId
        },
        [monitors, t]
    )
}
