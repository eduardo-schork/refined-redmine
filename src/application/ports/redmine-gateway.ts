import type {
    Attachment,
    Issue,
    IssueDetail,
    IssuePriority,
    IssueStatus,
    Named,
    Page,
    Project,
    RedmineUser,
    SavedQuery,
    Version
} from '@domain/redmine/entities'
import type { IssueFieldsChange, NewIssue } from '@domain/redmine/issue-edit'
import type { IssueUpload, UploadedFile } from '@domain/redmine/issue-upload'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import type { LocalDate } from '@domain/shared/date'
import type { TimeEntry, TimeEntryActivity, TimeEntryDraft } from '@domain/time/time-entry'

export interface RedmineCredentials {
    baseUrl: string
    apiKey: string
}

/** Time entries of the signed-in user, of an issue, or both, between two dates (inclusive). */
export interface TimeEntryQuery {
    mine?: boolean
    issueId?: number
    from?: LocalDate
    to?: LocalDate
}

export interface IssueUpdate extends IssueFieldsChange {
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
    /** `uploads`: files already sent with `uploadFile`, attached to the new issue. */
    createIssue(issue: NewIssue, uploads?: UploadedFile[]): Promise<Issue>
    /** Sends a file to Redmine before the issue exists; it is attached by the returned token. */
    uploadFile(upload: IssueUpload): Promise<UploadedFile>
    listStatuses(): Promise<IssueStatus[]>
    listProjects(): Promise<Project[]>
    listSavedQueries(): Promise<SavedQuery[]>
    listVersions(projectId: number): Promise<Version[]>
    /** Project members (users and groups) — the people issues of the project can be assigned to. */
    listProjectMembers(projectId: number): Promise<Named[]>
    /** Trackers (issue types) enabled in the project. */
    listProjectTrackers(projectId: number): Promise<Named[]>
    listPriorities(): Promise<IssuePriority[]>
    listTimeEntries(query: TimeEntryQuery): Promise<TimeEntry[]>
    createTimeEntry(draft: TimeEntryDraft): Promise<TimeEntry>
    updateTimeEntry(id: number, draft: TimeEntryDraft): Promise<void>
    deleteTimeEntry(id: number): Promise<void>
    listTimeEntryActivities(): Promise<TimeEntryActivity[]>
    getAttachment(id: number): Promise<Attachment>
    /** The attachment's content from the configured Redmine; refuses files larger than `maxBytes`. */
    downloadAttachment(id: number, maxBytes: number): Promise<Uint8Array>
}
