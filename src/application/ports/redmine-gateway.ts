import type {
    Issue,
    IssueDetail,
    IssueStatus,
    Page,
    Project,
    RedmineUser,
    SavedQuery,
    Version
} from '@domain/redmine/entities'
import type { IssueFilter } from '@domain/redmine/issue-filter'

export interface RedmineCredentials {
    baseUrl: string
    apiKey: string
}

export interface IssueUpdate {
    statusId?: number
    notes?: string
}

/** Errors surface as AppError. Without explicit credentials, the session ones are used. */
export interface RedmineGateway {
    currentUser(credentials?: RedmineCredentials): Promise<RedmineUser>
    listIssues(filter: IssueFilter, max?: number): Promise<Page<Issue>>
    countIssues(filter: IssueFilter): Promise<number>
    getIssue(id: number): Promise<IssueDetail>
    getIssueWithJournals(id: number): Promise<IssueDetail>
    allowedStatuses(issueId: number): Promise<IssueStatus[]>
    updateIssue(id: number, update: IssueUpdate): Promise<void>
    listStatuses(): Promise<IssueStatus[]>
    listProjects(): Promise<Project[]>
    listSavedQueries(): Promise<SavedQuery[]>
    listVersions(projectId: number): Promise<Version[]>
}
