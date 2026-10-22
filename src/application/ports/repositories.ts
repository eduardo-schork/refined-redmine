import type { OvertimeBank } from '@domain/time/overtime'
import type { CalendarChange, CalendarEvent } from '@domain/calendar/calendar-event'
import type { QuerySnapshot } from '@domain/monitor/query-diff'
import type { AppNotification } from '@domain/notification/notification'
import type { DeliveryConfirmation, DeliveryRecord } from '@domain/notification/permission'
import type { Settings } from '@domain/settings/settings'
import type { TimerState } from '@domain/time/timer'

export interface SettingsRepository {
    get(): Settings
    save(settings: Settings): void
}

/** API key stored with OS encryption (Keychain/DPAPI). */
export interface SecretStore {
    getApiKey(): string | null
    saveApiKey(apiKey: string): void
    clear(): void
    hasApiKey(): boolean
}

export interface NotificationRepository {
    list(): AppNotification[]
    add(items: AppNotification[]): void
    markRead(ids: string[] | 'all'): AppNotification[]
    clear(): void
}

/** Monitor state between cycles: watermark, query/queue snapshots and last delivery result. */
export interface MonitorStateRepository {
    getWatermark(): string | undefined
    setWatermark(iso: string): void
    getSnapshot(id: string): QuerySnapshot | undefined
    setSnapshot(id: string, snapshot: QuerySnapshot): void
    deleteSnapshot(id: string): void
    /** Deletes every snapshot whose id is not in the list. */
    pruneSnapshots(keepIds: string[]): void
    /** Clears the watermark and snapshots (on logout). */
    reset(): void
    getDelivery(): DeliveryRecord | undefined
    setDelivery(record: DeliveryRecord): void
    getConfirmation(): DeliveryConfirmation | undefined
    setConfirmation(confirmation: DeliveryConfirmation): void
}

/** The stopwatch, kept on disk so it survives closing and reopening the app. */
export interface TimerRepository {
    get(): TimerState | null
    save(timer: TimerState | null): void
}

export interface CalendarRepository {
    list(): CalendarEvent[]
    apply(change: CalendarChange): CalendarEvent[]
    wasFired(key: string): boolean
    markFired(keys: string[], atIso: string): void
    pruneFired(olderThanIso: string): void
}

/** The overtime bank, kept only in the app. */
export interface OvertimeRepository {
    load(): OvertimeBank
    save(bank: OvertimeBank): OvertimeBank
}
