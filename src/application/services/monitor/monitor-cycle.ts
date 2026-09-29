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
 * - the same change seen by two monitors becomes one notification that lists both sources.
 */
export class MonitorCycle {
    private readonly histories = new Map<number, Promise<IssueDetail | undefined>>()
    private readonly collected = new Map<string, AppNotification>()
    private readonly reportedJournals = new Set<number>()
    private countedReads = 0
    private newest: string
    journalLimitReached = false

    constructor(
        private readonly deps: CycleDeps,
        readonly since: string,
        readonly me: RedmineUser,
        readonly links: RedmineLinks,
        readonly statuses: ReadonlyMap<number, IssueStatus>
    ) {
        this.newest = since
    }

    statusName(statusId: number): string | undefined {
        return this.statuses.get(statusId)?.name
    }

    /** The watermark advances to the newest update seen by any monitor. */
    sawUpdate(issue: Issue): void {
        if (issue.updated_on > this.newest) this.newest = issue.updated_on
    }

    newestUpdate(): string {
        return this.newest
    }

    isNew(issue: Issue): boolean {
        return issue.updated_on > this.since
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

    /** New journals written by someone else and not yet reported in this cycle. */
    journalsToNotify(issue: IssueDetail): Journal[] {
        return issue.journals.filter((journal) => {
            const isNew = journal.created_on > this.since
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
    async changedByMe(issueId: number): Promise<boolean> {
        const issue = await this.history(issueId)
        if (!issue) return false
        const recentJournals = issue.journals.filter((journal) => journal.created_on > this.since)
        const lastJournal = recentJournals.at(-1)
        if (lastJournal) return lastJournal.user.id === this.me.id
        const createdByMe = issue.author.id === this.me.id
        return createdByMe && issue.created_on > this.since
    }

    add(key: string, draft: NotificationDraft, source: NotificationSource): void {
        const existing = this.collected.get(key)
        if (existing) {
            const alreadyListed = existing.sources?.some((listed) => listed.monitorId === source.monitorId)
            if (!alreadyListed) existing.sources = [...(existing.sources ?? []), source]
            return
        }
        this.collected.set(key, this.toNotification(draft, source))
    }

    notifications(): AppNotification[] {
        return [...this.collected.values()]
    }

    private toNotification(draft: NotificationDraft, source: NotificationSource): AppNotification {
        return {
            id: this.deps.ids.next(),
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
