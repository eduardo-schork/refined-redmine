import type {
    CalendarRepository,
    MonitorStateRepository,
    NotificationRepository,
    SettingsRepository
} from '@application/ports/repositories'
import { applyChange } from '@domain/calendar/event-editing'
import type { CalendarChange } from '@domain/calendar/calendar-event'
import type { QuerySnapshot } from '@domain/monitor/query-diff'
import { MAX_NOTIFICATIONS, type AppNotification, type NotificationTarget } from '@domain/notification/notification'
import type { DeliveryRecord } from '@domain/notification/permission'
import { withDefaults, type Settings } from '@domain/settings/settings'
import type { CalendarFile, ConfigFile, LegacyNotification, StateFile } from './files'
import type { JsonFile } from './json-file'

export class JsonSettingsRepository implements SettingsRepository {
    constructor(private readonly file: JsonFile<ConfigFile>) {}

    get(): Settings {
        const { apiKeyEnc: _encrypted, apiKeyPlain: _plain, ...settings } = this.file.read()
        return withDefaults(settings)
    }

    save(settings: Settings): void {
        // Preserves the API key, which belongs to the SecretStore.
        this.file.update((current) => ({ ...settings, apiKeyEnc: current.apiKeyEnc, apiKeyPlain: current.apiKeyPlain }))
    }
}

const APP_ROUTE_PREFIX = 'app:'

function legacyTarget(url: string): NotificationTarget {
    if (!url.startsWith(APP_ROUTE_PREFIX)) return { type: 'url', url }
    const route = url.slice(APP_ROUTE_PREFIX.length)
    if (!route) return { type: 'url', url }
    return { type: 'route', route }
}

/** Converts old notifications (pre-rendered text) to the current model. */
function upgrade(stored: AppNotification | LegacyNotification): AppNotification {
    if ('payload' in stored) return stored
    return {
        id: stored.id,
        kind: stored.kind,
        issueId: stored.issueId,
        payload: { type: 'legacy', title: stored.title, body: stored.body },
        target: legacyTarget(stored.url),
        createdAt: stored.createdAt,
        read: stored.read
    }
}

function markAsRead(notification: AppNotification, ids: string[] | 'all'): AppNotification {
    const selected = ids === 'all' || ids.includes(notification.id)
    if (!selected) return notification
    return { ...notification, read: true }
}

export class JsonNotificationRepository implements NotificationRepository {
    constructor(private readonly file: JsonFile<StateFile>) {}

    list(): AppNotification[] {
        return this.file.read().events.map(upgrade)
    }

    add(items: AppNotification[]): void {
        this.file.update((state) => {
            const events = [...items, ...state.events.map(upgrade)].slice(0, MAX_NOTIFICATIONS)
            return { ...state, events }
        })
    }

    markRead(ids: string[] | 'all'): AppNotification[] {
        const updated = this.file.update((state) => {
            const events = state.events.map(upgrade).map((notification) => markAsRead(notification, ids))
            return { ...state, events }
        })
        return updated.events.map(upgrade)
    }

    clear(): void {
        this.file.update((state) => ({ ...state, events: [] }))
    }
}

export class JsonMonitorStateRepository implements MonitorStateRepository {
    constructor(private readonly file: JsonFile<StateFile>) {}

    getWatermark() {
        return this.file.read().lastCheckAt
    }

    setWatermark(iso: string) {
        this.file.update((state) => ({ ...state, lastCheckAt: iso }))
    }

    getSnapshot(id: string) {
        return this.file.read().querySnapshots[id]
    }

    setSnapshot(id: string, snapshot: QuerySnapshot) {
        this.file.update((state) => ({ ...state, querySnapshots: { ...state.querySnapshots, [id]: snapshot } }))
    }

    deleteSnapshot(id: string) {
        if (!(id in this.file.read().querySnapshots)) return
        this.file.update((state) => {
            const { [id]: _removed, ...remaining } = state.querySnapshots
            return { ...state, querySnapshots: remaining }
        })
    }

    pruneSnapshots(keepIds: string[]) {
        const snapshots = this.file.read().querySnapshots
        const staleIds = Object.keys(snapshots).filter((id) => !keepIds.includes(id))
        if (!staleIds.length) return
        this.file.update((state) => {
            const kept = Object.fromEntries(Object.entries(state.querySnapshots).filter(([id]) => keepIds.includes(id)))
            return { ...state, querySnapshots: kept }
        })
    }

    reset() {
        this.file.update((state) => ({ ...state, lastCheckAt: undefined, querySnapshots: {} }))
    }

    getDelivery(): DeliveryRecord | undefined {
        const stored = this.file.read().notify
        if (!stored) return undefined
        return { ok: stored.ok, at: stored.at, detail: stored.error }
    }

    setDelivery(record: DeliveryRecord) {
        const notify = { ok: record.ok, at: record.at, error: record.detail }
        this.file.update((state) => ({ ...state, notify }))
    }
}

export class JsonCalendarRepository implements CalendarRepository {
    constructor(private readonly file: JsonFile<CalendarFile>) {}

    list() {
        return this.file.read().events
    }

    apply(change: CalendarChange) {
        const updated = this.file.update((calendar) => ({ ...calendar, events: applyChange(calendar.events, change) }))
        return updated.events
    }

    wasFired(key: string) {
        return Boolean(this.file.read().fired[key])
    }

    markFired(keys: string[], atIso: string) {
        const newlyFired = Object.fromEntries(keys.map((key) => [key, atIso]))
        this.file.update((calendar) => ({ ...calendar, fired: { ...calendar.fired, ...newlyFired } }))
    }

    pruneFired(olderThanIso: string) {
        const fired = this.file.read().fired
        const keptEntries = Object.entries(fired).filter(([, firedAt]) => firedAt >= olderThanIso)
        const nothingPruned = keptEntries.length === Object.keys(fired).length
        if (nothingPruned) return
        const kept = Object.fromEntries(keptEntries)
        this.file.update((calendar) => ({ ...calendar, fired: kept }))
    }
}
