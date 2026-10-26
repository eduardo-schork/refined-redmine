import type {
    AppNotification,
    IssueRef,
    NotificationKind,
    NotificationPayload,
    NotificationSource,
    NotificationTarget
} from '@domain/notification/notification'
import type { Issue, IssueDetail, IssueStatus, Journal, RedmineUser } from '@domain/redmine/entities'
import type { RedmineLinks } from '@domain/redmine/links'
import type { RedmineGateway } from '../../ports/redmine-gateway'
import type { Clock, IdGenerator } from '../../ports/system'

/** Most issue histories read per cycle, across all monitors. */
export const MAX_JOURNAL_READS_PER_CYCLE = 40

export interface CycleDeps {
    gateway: RedmineGateway
    clock: Clock
    ids: IdGenerator
}

/** What earlier cycles left: each monitor's own watermark and the changes already notified. */
export interface CycleMemory {
    monitorWatermarks: Readonly<Record<string, string>>
    notifiedKeys: ReadonlySet<string>
}

const NO_MEMORY: CycleMemory = { monitorWatermarks: {}, notifiedKeys: new Set() }

export interface NotificationDraft {
    kind: NotificationKind
    payload: NotificationPayload
    target: NotificationTarget
    issueId?: number
    createdAt?: string
}

/**
 * State shared by every monitor during one check cycle:
 * - each issue history is read once, even when several monitors see the issue;
 * - the same change seen by two monitors becomes one notification that lists both sources (and is not notified
 *   again when another monitor only sees it in a later cycle).
 */
export class MonitorCycle {
    private readonly histories = new Map<number, Promise<IssueDetail | undefined>>()
    private readonly collected = new Map<string, AppNotification>()
    private readonly reportedJournals = new Set<number>()
    private readonly advanced = new Map<string, string>()
    private countedReads = 0
    private newest: string
    journalLimitReached = false

    constructor(
        private readonly deps: CycleDeps,
        readonly since: string,
        readonly me: RedmineUser,
        readonly links: RedmineLinks,
        readonly statuses: ReadonlyMap<number, IssueStatus>,
        private readonly memory: CycleMemory = NO_MEMORY
    ) {
        this.newest = since
    }

    statusName(statusId: number): string | undefined {
        return this.statuses.get(statusId)?.name
    }

    /**
     * Since when a monitor looks for changes: the newest update of its own last listing. Monitors list one after the
     * other, so a shared watermark could pass a change made after one listed but before another saw something newer.
     * A monitor without one (first check, or switched back on) starts from the shared watermark.
     */
    sinceOf(monitorId: string): string {
        return this.memory.monitorWatermarks[monitorId] ?? this.since
    }

    /** Advances the monitor's watermark and the shared one (the newest update seen by any monitor). */
    sawUpdate(monitorId: string, issue: Issue): void {
        if (issue.updated_on > this.newest) this.newest = issue.updated_on
        const monitorNewest = this.advanced.get(monitorId) ?? this.sinceOf(monitorId)
        if (issue.updated_on > monitorNewest) this.advanced.set(monitorId, issue.updated_on)
    }

    newestUpdate(): string {
        return this.newest
    }

    /** Watermarks for the next cycle: the stored ones, advanced for the monitors checked now. */
    monitorWatermarks(checkedIds: string[]): Record<string, string> {
        const watermarks = { ...this.memory.monitorWatermarks }
        for (const monitorId of checkedIds) {
            watermarks[monitorId] = this.advanced.get(monitorId) ?? this.sinceOf(monitorId)
        }
        return watermarks
    }

    isNew(issue: Issue, monitorId: string): boolean {
        return issue.updated_on > this.sinceOf(monitorId)
    }

    /**
     * Issue with its history, read at most once per cycle. Counted reads stop at the per-cycle limit
     * (the issue is then skipped until the next cycle); queue exits are not counted, they have their own limit.
     */
    history(issueId: number, counted = true): Promise<IssueDetail | undefined> {
        const cached = this.histories.get(issueId)
        if (cached) return cached
        if (counted && this.countedReads >= MAX_JOURNAL_READS_PER_CYCLE) {
            this.journalLimitReached = true
            return Promise.resolve(undefined)
        }
        if (counted) this.countedReads++
        const loading = this.deps.gateway.getIssueWithJournals(issueId).catch(() => undefined)
        this.histories.set(issueId, loading)
        return loading
    }

    /** New journals (for this monitor) written by someone else and not yet reported in this cycle. */
    journalsToNotify(issue: IssueDetail, monitorId: string): Journal[] {
        const since = this.sinceOf(monitorId)
        return issue.journals.filter((journal) => {
            const isNew = journal.created_on > since
            const byOtherUser = journal.user.id !== this.me.id
            const alreadyReported = this.reportedJournals.has(journal.id)
            return isNew && byOtherUser && !alreadyReported
        })
    }

    /** Journals already explained by a queue exit are not reported again as plain changes. */
    markJournalReported(journalId: number): void {
        this.reportedJournals.add(journalId)
    }

    /** The last change since the previous cycle was made by the user (their own actions do not notify). */
    async changedByMe(issueId: number, monitorId: string): Promise<boolean> {
        const issue = await this.history(issueId)
        if (!issue) return false
        const since = this.sinceOf(monitorId)
        const recentJournals = issue.journals.filter((journal) => journal.created_on > since)
        const lastJournal = recentJournals.at(-1)
        if (lastJournal) return lastJournal.user.id === this.me.id
        const createdByMe = issue.author.id === this.me.id
        return createdByMe && issue.created_on > since
    }

    add(key: string, draft: NotificationDraft, source: NotificationSource): void {
        if (this.memory.notifiedKeys.has(key)) return
        const existing = this.collected.get(key)
        if (existing) {
            const alreadyListed = existing.sources?.some((listed) => listed.monitorId === source.monitorId)
            if (!alreadyListed) existing.sources = [...(existing.sources ?? []), source]
            return
        }
        this.collected.set(key, this.toNotification(key, draft, source))
    }

    notifications(): AppNotification[] {
        return [...this.collected.values()]
    }

    private toNotification(key: string, draft: NotificationDraft, source: NotificationSource): AppNotification {
        return {
            id: this.deps.ids.next(),
            key,
            kind: draft.kind,
            payload: draft.payload,
            issueId: draft.issueId,
            target: draft.target,
            createdAt: draft.createdAt ?? this.deps.clock.now().toISOString(),
            read: false,
            sources: [source]
        }
    }
}

export function issueRef(issue: Issue): IssueRef {
    return { id: issue.id, subject: issue.subject, tracker: issue.tracker?.name, project: issue.project?.name }
}

export const journalKey = (journalId: number) => `journal:${journalId}`
export const createdKey = (issueId: number) => `created:${issueId}`
export const queueExitKey = (issueId: number) => `queue:${issueId}`
export const membershipKey = (monitorId: string) => `members:${monitorId}`
export const countKey = (monitorId: string) => `count:${monitorId}`

/** A journal or a new issue is one change, notified once; entries, exits and counts can happen again. */
export const isOneTimeKey = (key: string) => key.startsWith('journal:') || key.startsWith('created:')
