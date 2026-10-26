import type { LogLevel, LogRecord } from '@domain/log/log-entry'
import { isEventEnabled, MINE_MONITOR_ID, type Monitor } from '@domain/monitor/monitor'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import { isWithinSchedule } from '@domain/monitor/schedule'
import type { AppNotification } from '@domain/notification/notification'
import type { IssueStatus } from '@domain/redmine/entities'
import { RedmineLinks } from '@domain/redmine/links'
import { MIN_POLL_SECONDS, type Settings } from '@domain/settings/settings'
import { serializeError } from '@domain/shared/errors'
import type { ActivityLog } from '../ports/activity-log'
import type { RedmineGateway } from '../ports/redmine-gateway'
import type {
    MonitorStateRepository,
    NotificationRepository,
    SecretStore,
    SettingsRepository
} from '../ports/repositories'
import type { AppEventsPublisher, Cancel, Clock, IdGenerator, Scheduler, SystemNotifier } from '../ports/system'
import type { BoardFilterResolver } from '../use-cases/boards'
import { checkMine, QUEUE_SNAPSHOT } from './monitor/mine-check'
import { isOneTimeKey, MonitorCycle, type CycleMemory } from './monitor/monitor-cycle'
import { checkSource } from './monitor/source-check'

const FIRST_DELAY_MS = 1_000
// Right after waking up the network is often not back yet.
const AFTER_WAKE_DELAY_MS = 10_000

export interface MonitorDeps {
    gateway: RedmineGateway
    settings: SettingsRepository
    secrets: SecretStore
    state: MonitorStateRepository
    notifications: NotificationRepository
    notifier: SystemNotifier
    events: AppEventsPublisher
    clock: Clock
    ids: IdGenerator
    scheduler: Scheduler
    log: ActivityLog
    boardFilter: BoardFilterResolver
}

/**
 * Redmine check cycle, run every `pollSeconds`:
 * each enabled monitor ("my issues", saved queries, copied filters, boards) is checked in order,
 * and the notifications found are deduplicated and published together.
 * On the first run it only records the watermark and the snapshots.
 */
export class MonitorService {
    private cancel: Cancel | null = null
    private running = false
    private status: MonitorStatus = { running: false }
    private statuses: Map<number, IssueStatus> | null = null

    constructor(private readonly deps: MonitorDeps) {}

    getStatus(): MonitorStatus {
        return this.status
    }

    start(): void {
        this.stop()
        this.schedule(FIRST_DELAY_MS)
    }

    stop(): void {
        this.cancel?.()
        this.cancel = null
    }

    /** The computer woke up: the pending timer was frozen during sleep, so the next check is brought forward. */
    checkAfterWake(): void {
        if (this.running) return
        this.stop()
        this.schedule(AFTER_WAKE_DELAY_MS)
    }

    async runNow(): Promise<MonitorStatus> {
        this.stop()
        await this.cycle(true)
        return this.status
    }

    private schedule(delayMs: number): void {
        const nextCheckAt = new Date(this.deps.clock.now().getTime() + delayMs).toISOString()
        this.status = { ...this.status, nextCheckAt }
        this.cancel = this.deps.scheduler.after(delayMs, () => void this.cycle(false))
    }

    private setStatus(patch: Partial<MonitorStatus>): void {
        this.status = { ...this.status, ...patch }
        this.deps.events.monitorStatusChanged(this.status)
    }

    private log(record: LogRecord, level?: LogLevel): void {
        this.deps.log.write(record, level)
    }

    private async cycle(manual: boolean): Promise<void> {
        if (this.running) return
        const settings = this.deps.settings.get()
        try {
            const pauseReason = this.pauseReason(settings, manual)
            if (pauseReason) {
                this.pause(pauseReason)
                return
            }
            this.running = true
            this.setStatus({ running: true, paused: undefined, lastError: undefined })
            await this.runChecks(settings)
            this.setStatus({ running: false, lastCheckAt: this.deps.clock.now().toISOString() })
        } catch (error) {
            const serialized = serializeError(error)
            this.log({ type: 'monitor', event: 'cycleFailed', params: { code: serialized.code } }, 'error')
            this.setStatus({ running: false, lastError: serialized })
        } finally {
            this.running = false
            const pollSeconds = Math.max(MIN_POLL_SECONDS, settings.pollSeconds)
            this.schedule(pollSeconds * 1000)
        }
    }

    /** Logged only when the reason changes, not on every skipped cycle. */
    private pause(reason: NonNullable<MonitorStatus['paused']>): void {
        if (this.status.paused !== reason) this.log({ type: 'monitor', event: 'cyclePaused', params: { reason } })
        this.setStatus({ paused: reason, running: false })
    }

    private pauseReason(settings: Settings, manual: boolean): MonitorStatus['paused'] {
        const hasCredentials = this.deps.secrets.hasApiKey() && Boolean(settings.user)
        if (!hasCredentials) return 'no-credentials'
        if (manual) return undefined
        const withinSchedule = isWithinSchedule(settings.schedule, this.deps.clock.now())
        if (!withinSchedule) return 'schedule'
        return undefined
    }

    private async runChecks(settings: Settings): Promise<void> {
        const startedAt = this.deps.clock.now().getTime()
        const enabledMonitors = settings.monitors.filter((monitor) => monitor.enabled)
        this.pruneSnapshots(enabledMonitors)

        const cycle = await this.newCycle(settings, enabledMonitors)
        const dueMonitors = enabledMonitors.filter((monitor) => this.isDue(monitor))
        const checkedIds: string[] = []
        for (const monitor of dueMonitors) {
            const checked = await this.checkMonitor(monitor, settings, cycle)
            if (checked) checkedIds.push(monitor.id)
        }

        this.deps.state.setWatermark(cycle.newestUpdate())
        this.deps.state.setMonitorWatermarks(cycle.monitorWatermarks(checkedIds))
        if (cycle.journalLimitReached) this.log({ type: 'monitor', event: 'journalLimit' }, 'warn')

        const found = cycle.notifications()
        this.publish(found)
        const durationMs = this.deps.clock.now().getTime() - startedAt
        const params = { monitors: dueMonitors.length, notifications: found.length, durationMs }
        this.log({ type: 'monitor', event: 'cycleFinished', params })
    }

    /** Without a watermark (first run), it starts now: nothing older is reported. */
    private async newCycle(settings: Settings, enabledMonitors: Monitor[]): Promise<MonitorCycle> {
        const since = this.deps.state.getWatermark() ?? this.nowWithoutMilliseconds()
        const links = new RedmineLinks(settings.baseUrl)
        const statuses = await this.statusMap()
        const cycleDeps = { gateway: this.deps.gateway, clock: this.deps.clock, ids: this.deps.ids }
        return new MonitorCycle(cycleDeps, since, settings.user!, links, statuses, this.memory(enabledMonitors))
    }

    /** A monitor switched off loses its watermark, so switching it back on starts from now instead of flooding. */
    private memory(enabledMonitors: Monitor[]): CycleMemory {
        const enabledIds = new Set(enabledMonitors.map((monitor) => monitor.id))
        const stored = Object.entries(this.deps.state.getMonitorWatermarks())
        const monitorWatermarks = Object.fromEntries(stored.filter(([monitorId]) => enabledIds.has(monitorId)))
        const keys = this.deps.notifications.list().map((notification) => notification.key ?? '')
        return { monitorWatermarks, notifiedKeys: new Set(keys.filter(isOneTimeKey)) }
    }

    private isDue(monitor: Monitor): boolean {
        if (!monitor.schedule) return true
        return isWithinSchedule(monitor.schedule, this.deps.clock.now())
    }

    /** A monitor that is switched back on starts from a new snapshot instead of reporting everything at once. */
    private pruneSnapshots(enabledMonitors: Monitor[]): void {
        const keepIds = enabledMonitors.map((monitor) => monitor.id)
        const mine = enabledMonitors.find((monitor) => monitor.id === MINE_MONITOR_ID)
        const keepsQueue = mine && isEventEnabled(mine, 'left')
        if (keepsQueue) keepIds.push(QUEUE_SNAPSHOT)
        this.deps.state.pruneSnapshots(keepIds)
    }

    /** One monitor failing does not stop the others; it keeps its watermark, to try the same changes again. */
    private async checkMonitor(monitor: Monitor, settings: Settings, cycle: MonitorCycle): Promise<boolean> {
        try {
            await this.runMonitor(monitor, settings, cycle)
            return true
        } catch (error) {
            const serialized = serializeError(error)
            const params = { monitor: monitor.id, code: serialized.code }
            this.log({ type: 'monitor', event: 'monitorFailed', params }, 'error')
            this.setStatus({ lastError: { ...serialized, context: monitor.name || monitor.id } })
            return false
        }
    }

    private async runMonitor(monitor: Monitor, settings: Settings, cycle: MonitorCycle): Promise<void> {
        const source = monitor.source
        if (source.type === 'mine') {
            await checkMine(monitor, source.scopes, cycle, this.deps)
            return
        }
        const sourceDeps = {
            gateway: this.deps.gateway,
            state: this.deps.state,
            boards: () => settings.boards,
            boardFilter: this.deps.boardFilter,
            log: (record: LogRecord, level?: LogLevel) => this.log(record, level)
        }
        await checkSource(monitor, source, cycle, sourceDeps)
    }

    private publish(items: AppNotification[]): void {
        if (!items.length) return
        this.deps.notifications.add(items)
        this.deps.notifier.show(items)
        this.deps.events.notificationsChanged(this.deps.notifications.list())
    }

    private async statusMap(): Promise<Map<number, IssueStatus>> {
        if (!this.statuses) {
            const statuses = await this.deps.gateway.listStatuses()
            this.statuses = new Map(statuses.map((status) => [status.id, status]))
        }
        return this.statuses
    }

    /** Redmine timestamps have no milliseconds, and the watermark is compared to them as a string. */
    private nowWithoutMilliseconds(): string {
        const nowIso = this.deps.clock.now().toISOString()
        return nowIso.replace(/\.\d{3}Z$/, 'Z')
    }
}
