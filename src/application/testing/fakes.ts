import { applyChange } from '@domain/calendar/event-editing'
import type { CalendarChange, CalendarEvent } from '@domain/calendar/calendar-event'
import type { LogEntry, LogLevel, LogRecord } from '@domain/log/log-entry'
import type { QuerySnapshot } from '@domain/monitor/query-diff'
import type { MonitorStatus } from '@domain/monitor/monitor-status'
import type { AppNotification } from '@domain/notification/notification'
import type { DeliveryConfirmation, DeliveryRecord, NotifyPermissionInfo } from '@domain/notification/permission'
import type { Attachment, Issue, IssueDetail, IssueStatus, Page, RedmineUser, Version } from '@domain/redmine/entities'
import type { NewIssue } from '@domain/redmine/issue-edit'
import type { IssueUpload, UploadedFile } from '@domain/redmine/issue-upload'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import { DEFAULT_SETTINGS, type Settings } from '@domain/settings/settings'
import { AppError } from '@domain/shared/errors'
import type { TimeEntry, TimeEntryActivity, TimeEntryDraft } from '@domain/time/time-entry'
import type { TimerState } from '@domain/time/timer'
import type { UpdateStatus } from '@domain/update/release'
import type { ActivityLog } from '../ports/activity-log'
import type { IssueUpdate, RedmineCredentials, RedmineGateway, TimeEntryQuery } from '../ports/redmine-gateway'
import type {
    CalendarRepository,
    MonitorStateRepository,
    NotificationRepository,
    SecretStore,
    SettingsRepository,
    TimerRepository
} from '../ports/repositories'
import type { AppEventsPublisher, Clock, IdGenerator, Scheduler, SystemNotifier } from '../ports/system'

export const ME: RedmineUser = { id: 42, login: 'marina.costa', firstname: 'Marina', lastname: 'Costa' }

export class FakeGateway implements RedmineGateway {
    issues: Issue[] = []
    details = new Map<number, IssueDetail>()
    statuses: IssueStatus[] = [
        { id: 1, name: 'Nova', is_closed: false },
        { id: 2, name: 'Em andamento', is_closed: false },
        { id: 5, name: 'Finalizada', is_closed: true }
    ]
    allowed = new Map<number, IssueStatus[]>()
    versions: Version[] = []
    updates: { id: number; update: IssueUpdate }[] = []
    validKey = 'key'
    /** Result per filter (filter JSON → issues); defaults to `issues`. */
    byFilter = new Map<string, Issue[]>()
    filters: IssueFilter[] = []

    async currentUser(credentials?: RedmineCredentials) {
        if (credentials && credentials.apiKey !== this.validKey) throw new AppError('redmine.unauthorized', {}, 401)
        return ME
    }
    async listIssues(filter: IssueFilter): Promise<Page<Issue>> {
        this.filters.push(filter)
        const items = this.byFilter.get(JSON.stringify(filter)) ?? this.issues
        return { items, total: items.length }
    }
    async countIssues(filter: IssueFilter) {
        return (await this.listIssues(filter)).total
    }
    async getIssue(id: number) {
        const found = this.details.get(id)
        if (!found) throw new AppError('redmine.notFound')
        return found
    }
    getIssueWithJournals(id: number) {
        return this.getIssue(id)
    }
    async allowedStatuses(id: number) {
        return this.allowed.get(id) ?? this.statuses
    }
    async updateIssue(id: number, update: IssueUpdate) {
        this.updates.push({ id, update })
    }
    created: NewIssue[] = []
    attachedUploads: UploadedFile[][] = []
    sentFiles: IssueUpload[] = []
    async uploadFile(upload: IssueUpload): Promise<UploadedFile> {
        this.sentFiles.push(upload)
        return { token: `token-${this.sentFiles.length}`, filename: upload.filename, contentType: upload.contentType }
    }
    async createIssue(issue: NewIssue, uploads: UploadedFile[] = []): Promise<Issue> {
        this.created.push(issue)
        this.attachedUploads.push(uploads)
        return { id: 5000 + this.created.length, subject: issue.subject } as Issue
    }
    async listStatuses() {
        return this.statuses
    }
    async listProjects() {
        return []
    }
    async listSavedQueries() {
        return []
    }
    async listVersions() {
        return this.versions
    }
    members: { id: number; name: string }[] = []
    async listProjectMembers() {
        return this.members
    }
    async listProjectTrackers() {
        return [
            { id: 1, name: 'Desenvolvimento' },
            { id: 2, name: 'Defeito' }
        ]
    }
    async listTrackers() {
        return this.listProjectTrackers()
    }
    async listPriorities() {
        return [
            { id: 2, name: 'Normal', is_default: true },
            { id: 3, name: 'Alta', is_default: false }
        ]
    }
    timeEntries: TimeEntry[] = []
    createdTimeEntries: TimeEntryDraft[] = []
    async listTimeEntries(query: TimeEntryQuery) {
        const inRange = (entry: TimeEntry) =>
            (!query.from || entry.spent_on >= query.from) && (!query.to || entry.spent_on <= query.to)
        const ofIssue = (entry: TimeEntry) => !query.issueId || entry.issue?.id === query.issueId
        return this.timeEntries.filter((entry) => inRange(entry) && ofIssue(entry))
    }
    async createTimeEntry(draft: TimeEntryDraft): Promise<TimeEntry> {
        this.createdTimeEntries.push(draft)
        return {
            id: 1000 + this.createdTimeEntries.length,
            project: { id: 10, name: 'Loja Virtual' },
            issue: { id: draft.issueId },
            user: { id: ME.id, name: 'Marina Costa' },
            activity: { id: draft.activityId ?? 9, name: 'Desenvolvimento' },
            hours: draft.hours,
            comments: draft.comments,
            spent_on: draft.spentOn,
            created_on: '',
            updated_on: ''
        }
    }
    async updateTimeEntry() {}
    async deleteTimeEntry() {}
    async listTimeEntryActivities(): Promise<TimeEntryActivity[]> {
        return [
            { id: 9, name: 'Desenvolvimento', is_default: true },
            { id: 10, name: 'Reunião', active: false }
        ]
    }
    attachments = new Map<number, { attachment: Attachment; bytes: Uint8Array }>()
    downloads: number[] = []
    async getAttachment(id: number) {
        const found = this.attachments.get(id)
        if (!found) throw new AppError('redmine.notFound')
        return found.attachment
    }
    async downloadAttachment(id: number, maxBytes: number) {
        this.downloads.push(id)
        const { bytes } = this.attachments.get(id)!
        if (bytes.length > maxBytes) throw new AppError('attachment.tooLarge')
        return bytes
    }
}

export class MemorySettings implements SettingsRepository {
    constructor(public value: Settings = { ...DEFAULT_SETTINGS, baseUrl: 'https://redmine.test', user: ME }) {}
    get() {
        return this.value
    }
    save(settings: Settings) {
        this.value = settings
    }
}

export class MemorySecrets implements SecretStore {
    constructor(public key: string | null = 'key') {}
    getApiKey() {
        return this.key
    }
    saveApiKey(apiKey: string) {
        this.key = apiKey
    }
    clear() {
        this.key = null
    }
    hasApiKey() {
        return Boolean(this.key)
    }
}

export class MemoryNotifications implements NotificationRepository {
    items: AppNotification[] = []
    list() {
        return this.items
    }
    add(items: AppNotification[]) {
        this.items = [...items, ...this.items]
    }
    markRead(ids: string[] | 'all') {
        const shouldMark = (notification: AppNotification) => ids === 'all' || ids.includes(notification.id)
        this.items = this.items.map((notification) =>
            shouldMark(notification) ? { ...notification, read: true } : notification
        )
        return this.items
    }
    clear() {
        this.items = []
    }
}

export class MemoryMonitorState implements MonitorStateRepository {
    watermark?: string
    snapshots = new Map<string, QuerySnapshot>()
    delivery?: DeliveryRecord
    confirmation?: DeliveryConfirmation
    getWatermark() {
        return this.watermark
    }
    setWatermark(iso: string) {
        this.watermark = iso
    }
    getSnapshot(id: string) {
        return this.snapshots.get(id)
    }
    setSnapshot(id: string, snapshot: QuerySnapshot) {
        this.snapshots.set(id, snapshot)
    }
    deleteSnapshot(id: string) {
        this.snapshots.delete(id)
    }
    pruneSnapshots(keepIds: string[]) {
        for (const id of [...this.snapshots.keys()]) {
            if (!keepIds.includes(id)) this.snapshots.delete(id)
        }
    }
    reset() {
        this.watermark = undefined
        this.snapshots.clear()
    }
    getDelivery() {
        return this.delivery
    }
    setDelivery(record: DeliveryRecord) {
        this.delivery = record
    }
    getConfirmation() {
        return this.confirmation
    }
    setConfirmation(confirmation: DeliveryConfirmation) {
        this.confirmation = confirmation
    }
}

export class MemoryCalendar implements CalendarRepository {
    events: CalendarEvent[] = []
    fired = new Map<string, string>()
    list() {
        return this.events
    }
    apply(change: CalendarChange) {
        this.events = applyChange(this.events, change)
        return this.events
    }
    wasFired(key: string) {
        return this.fired.has(key)
    }
    markFired(keys: string[], atIso: string) {
        for (const key of keys) this.fired.set(key, atIso)
    }
    pruneFired(olderThanIso: string) {
        for (const [key, firedAt] of this.fired) {
            if (firedAt < olderThanIso) this.fired.delete(key)
        }
    }
}

export class FakeNotifier implements SystemNotifier {
    shown: AppNotification[] = []
    show(items: AppNotification[]) {
        this.shown.push(...items)
    }
    async probe() {
        return { shown: true }
    }
}

export class FakeEvents implements AppEventsPublisher {
    statuses: MonitorStatus[] = []
    notificationsChanged() {}
    monitorStatusChanged(status: MonitorStatus) {
        this.statuses.push(status)
    }
    permissionChanged(_info: NotifyPermissionInfo) {}
    updates: UpdateStatus[] = []
    updateStatusChanged(status: UpdateStatus) {
        this.updates.push(status)
    }
    timers: (TimerState | null)[] = []
    timerChanged(timer: TimerState | null) {
        this.timers.push(timer)
    }
}

export class MemoryTimer implements TimerRepository {
    constructor(public value: TimerState | null = null) {}
    get() {
        return this.value
    }
    save(timer: TimerState | null) {
        this.value = timer
    }
}

export class FixedClock implements Clock {
    constructor(public current: Date) {}
    now() {
        return this.current
    }
}

export class SeqIds implements IdGenerator {
    private counter = 0
    next() {
        this.counter += 1
        return `id${this.counter}`
    }
}

/** Schedules nothing: tests call runNow(). */
export const noScheduler: Scheduler = { after: () => () => {}, every: () => () => {} }

export const issue = (id: number, patch: Partial<Issue> = {}): Issue => ({
    id,
    subject: `Tarefa ${id}`,
    project: { id: 10, name: 'Loja Virtual' },
    tracker: { id: 42, name: 'Desenvolvimento' },
    status: { id: 1, name: 'Nova', is_closed: false },
    priority: { id: 2, name: 'Normal' },
    author: { id: 8, name: 'Lucas' },
    assigned_to: { id: ME.id, name: 'Marina Costa' },
    done_ratio: 0,
    created_on: '2026-09-01T10:00:00Z',
    updated_on: '2026-09-01T10:00:00Z',
    ...patch
})

export const detail = (baseIssue: Issue, patch: Partial<IssueDetail> = {}): IssueDetail => ({
    ...baseIssue,
    journals: [],
    attachments: [],
    relations: [],
    children: [],
    watchers: [],
    allowed_statuses: [],
    ...patch
})

export class MemoryActivityLog implements ActivityLog {
    entries: LogEntry[] = []
    write(record: LogRecord, level: LogLevel = 'info') {
        const entry = { ...record, id: String(this.entries.length + 1), at: new Date(0).toISOString(), level }
        this.entries = [entry, ...this.entries]
    }
    list() {
        return this.entries
    }
    clear() {
        this.entries = []
    }
}
