import type {
    Issue,
    IssueDetail,
    IssuePriority,
    IssueStatus,
    Page,
    Project,
    SavedQuery
} from '@domain/redmine/entities'
import { assertValidChange, ignoredFields, type IssueFieldsChange } from '@domain/redmine/issue-edit'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import { MAX_SEARCH_RESULTS, parseIssueSearch, titleSearchQuery } from '@domain/redmine/issue-search'
import { AppError } from '@domain/shared/errors'
import type { IssueEditOptions, IssueEditResult } from '../dto'
import type { RedmineGateway } from '../ports/redmine-gateway'
import type { TimeEntryActivity } from '@domain/time/time-entry'

export class IssueQueries {
    constructor(private readonly gateway: RedmineGateway) {}

    list(filter: IssueFilter, max = 500): Promise<Page<Issue>> {
        return this.gateway.listIssues(filter, max)
    }

    get(id: number): Promise<IssueDetail> {
        return this.gateway.getIssue(id)
    }

    allowedStatuses(id: number): Promise<IssueStatus[]> {
        return this.gateway.allowedStatuses(id)
    }

    /** Quick search: an issue number opens that issue; text searches the titles in every project. */
    async search(input: string): Promise<Issue[]> {
        const search = parseIssueSearch(input)
        if (search.type === 'empty') return []
        if (search.type === 'id') return this.issueById(search.id)
        const page = await this.gateway.listIssues({ rawQuery: titleSearchQuery(search.term) }, MAX_SEARCH_RESULTS)
        return page.items
    }

    private async issueById(id: number): Promise<Issue[]> {
        try {
            return [await this.gateway.getIssue(id)]
        } catch (error) {
            const notVisible =
                error instanceof AppError && ['redmine.notFound', 'redmine.forbidden'].includes(error.code)
            if (notVisible) return []
            throw error
        }
    }

    /** People and versions of the issue's project; the closed versions are kept out. */
    async editOptions(projectId: number): Promise<IssueEditOptions> {
        const [members, versions] = await Promise.all([
            this.gateway.listProjectMembers(projectId),
            this.gateway.listVersions(projectId)
        ])
        return {
            assignees: [...members].sort(byName),
            versions: versions.filter((version) => version.status !== 'closed').sort(byName)
        }
    }
}

export class EditIssueFieldsUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    async execute(issueId: number, change: IssueFieldsChange): Promise<IssueEditResult> {
        const current = await this.gateway.getIssue(issueId)
        assertValidChange(current, change)
        await this.gateway.updateIssue(issueId, change)
        const saved = await this.gateway.getIssue(issueId)
        return { issue: saved, ignored: ignoredFields(change, saved) }
    }
}

function byName(first: { name: string }, second: { name: string }): number {
    return first.name.localeCompare(second.name)
}

/** Redmine reference data. Statuses and projects are cached in memory (they rarely change). */
export class ReferenceDataQueries {
    private cache = new Map<string, Promise<unknown>>()

    constructor(private readonly gateway: RedmineGateway) {}

    private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
        if (!this.cache.has(key)) this.cache.set(key, this.loadForgettingFailures(key, load))
        return this.cache.get(key) as Promise<T>
    }

    private async loadForgettingFailures<T>(key: string, load: () => Promise<T>): Promise<T> {
        try {
            return await load()
        } catch (error) {
            this.cache.delete(key)
            throw error
        }
    }

    statuses(): Promise<IssueStatus[]> {
        return this.cached('statuses', () => this.gateway.listStatuses())
    }

    projects(): Promise<Project[]> {
        return this.cached('projects', async () => {
            const projects = await this.gateway.listProjects()
            return projects.sort(byName)
        })
    }

    priorities(): Promise<IssuePriority[]> {
        return this.cached('priorities', async () => {
            const priorities = await this.gateway.listPriorities()
            return priorities.filter((priority) => priority.active !== false)
        })
    }

    /** Kinds of work for time entries (Development, Meeting…); inactive ones are not offered. */
    timeActivities(): Promise<TimeEntryActivity[]> {
        return this.cached('timeActivities', async () => {
            const activities = await this.gateway.listTimeEntryActivities()
            return activities.filter((activity) => activity.active !== false)
        })
    }

    /** Not cached: a query just created in Redmine must show up without restarting the app. */
    async savedQueries(): Promise<SavedQuery[]> {
        const queries = await this.gateway.listSavedQueries()
        return queries.sort(byName)
    }

    invalidate(): void {
        this.cache.clear()
    }
}

export class ChangeIssueStatusUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    execute(issueId: number, statusId: number): Promise<void> {
        return this.gateway.updateIssue(issueId, { statusId })
    }
}

export class CommentOnIssueUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    execute(issueId: number, notes: string): Promise<void> {
        return this.gateway.updateIssue(issueId, { notes })
    }
}
