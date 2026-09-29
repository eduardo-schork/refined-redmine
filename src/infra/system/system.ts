import { randomUUID } from 'node:crypto'
import type { Clock, IdGenerator, Scheduler } from '@application/ports/system'

export const systemClock: Clock = { now: () => new Date() }

export const uuidGenerator: IdGenerator = { next: () => randomUUID() }

export const timerScheduler: Scheduler = {
    after(ms, callback) {
        const timeout = setTimeout(callback, ms)
        return () => clearTimeout(timeout)
    },
    every(ms, callback) {
        const interval = setInterval(callback, ms)
        return () => clearInterval(interval)
    }
}
