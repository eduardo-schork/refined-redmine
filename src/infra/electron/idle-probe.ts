import { powerMonitor } from 'electron'
import type { IdleProbe } from '@application/ports/system'

export const electronIdleProbe: IdleProbe = {
    idleSeconds: () => powerMonitor.getSystemIdleTime()
}
