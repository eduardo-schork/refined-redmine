import type { Issue, IssueDetail, IssueStatus, Page, Project, SavedQuery } from '@domain/redmine/entities'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import type { RedmineGateway } from '../ports/redmine-gateway'

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
