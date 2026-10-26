import type {
    IssueUpdate,
    RedmineCredentials,
    RedmineGateway,
    TimeEntryQuery
} from '@application/ports/redmine-gateway'
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
import type { NewIssue } from '@domain/redmine/issue-edit'
import type { IssueUpload, UploadedFile } from '@domain/redmine/issue-upload'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import { addDays, parseLocal, toLocalDate, type LocalDate } from '@domain/shared/date'
import type { TimeEntry, TimeEntryActivity, TimeEntryDraft } from '@domain/time/time-entry'
import type { Params, RedmineHttpClient } from './http-client'

const PAGE = 100
const MAX_LISTED_ITEMS = 1000
const FULL_ISSUE_INCLUDES = 'journals,attachments,relations,children,watchers,allowed_statuses'
const SORT: Record<NonNullable<IssueFilter['sort']>, string> = {
    priority: 'priority:desc,updated_on:desc',
    updated: 'updated_on:desc',
    updatedDesc: 'updated_on:desc',
    id: 'id:desc'
}

/** Translates an issue filter into /issues.json parameters. */
export function issueParams(filter: IssueFilter): Params {
    // A copied filter already carries all its parameters in `rawQuery`.
    if (filter.rawQuery !== undefined) return {}
    // With query_id, Redmine uses the saved query's filters.
    if (filter.queryId) return { query_id: filter.queryId, project_id: filter.queryProjectId }

    const statusId = Array.isArray(filter.status) ? filter.status.join('|') : filter.status
    const excludeSubprojects = filter.project && !filter.project.includeSubprojects
    return {
        assigned_to_id: filter.assignedTo,
        watcher_id: filter.watcher,
        author_id: filter.author,
        status_id: statusId,
        project_id: filter.project?.id,
        subproject_id: excludeSubprojects ? '!*' : undefined,
        fixed_version_id: filter.versionId,
        updated_on: filter.updatedSince ? `>=${filter.updatedSince}` : undefined,
        sort: filter.sort ? SORT[filter.sort] : undefined
    }
}

type IssueDto = Issue & Partial<Omit<IssueDetail, keyof Issue>>

interface Membership {
    user?: Named
    group?: Named
}

/** Redmine clears a field with an empty string; undefined keys are left out of the JSON (field unchanged). */
const clearable = (value: number | string | null | undefined) => (value === null ? '' : value)

function issueBody(update: IssueUpdate) {
    return {
        status_id: update.statusId,
        notes: update.notes,
        subject: update.subject,
        description: update.description,
        tracker_id: update.trackerId,
        assigned_to_id: clearable(update.assignedToId),
        fixed_version_id: clearable(update.fixedVersionId),
        priority_id: update.priorityId,
        start_date: clearable(update.startDate),
        due_date: clearable(update.dueDate),
        done_ratio: update.doneRatio,
        estimated_hours: clearable(update.estimatedHours),
        parent_issue_id: clearable(update.parentIssueId),
        uploads: update.uploads?.map(uploadReference)
    }
}

function newIssueBody(issue: NewIssue, uploads: UploadedFile[]) {
    return {
        project_id: issue.projectId,
        tracker_id: issue.trackerId,
        subject: issue.subject,
        description: issue.description,
        priority_id: issue.priorityId,
        assigned_to_id: issue.assignedToId,
        fixed_version_id: issue.fixedVersionId,
        start_date: issue.startDate,
        due_date: issue.dueDate,
        estimated_hours: issue.estimatedHours,
        parent_issue_id: issue.parentIssueId,
        custom_fields: issue.customFields?.length ? issue.customFields : undefined,
        uploads: uploads.length ? uploads.map(uploadReference) : undefined
    }
}

function uploadReference(upload: UploadedFile) {
    return { token: upload.token, filename: upload.filename, content_type: upload.contentType }
}

/** Redmine omits the collections that were not requested in `include`. */
function toDetail(issue: IssueDto): IssueDetail {
    return {
        ...issue,
        journals: issue.journals ?? [],
        attachments: issue.attachments ?? [],
        relations: issue.relations ?? [],
        children: issue.children ?? [],
        watchers: issue.watchers ?? [],
        allowed_statuses: issue.allowed_statuses ?? []
    }
}

type PageResponse = Record<string, unknown> & { total_count?: number }

const MAX_TIME_ENTRIES = 1000

/** Without an activity Redmine uses its default one (when the instance has a default). */
function timeEntryBody(draft: TimeEntryDraft) {
    return {
        issue_id: draft.issueId,
        spent_on: draft.spentOn,
        hours: draft.hours,
        activity_id: draft.activityId,
        comments: draft.comments
    }
}

const shiftDay = (day: LocalDate, days: number) => toLocalDate(addDays(parseLocal(day), days))

function isWithinPeriod(day: LocalDate, period: { from?: LocalDate; to?: LocalDate }): boolean {
    const afterStart = !period.from || day >= period.from
    const beforeEnd = !period.to || day <= period.to
    return afterStart && beforeEnd
}

export class HttpRedmineGateway implements RedmineGateway {
    constructor(private readonly http: RedmineHttpClient) {}

    async currentUser(credentials?: RedmineCredentials): Promise<RedmineUser> {
        // Only the connection screen asks for the current user: it shows the error after one attempt (30 s at most).
        const response = await this.http.request<{ user: RedmineUser }>('GET', '/my/account.json', {
            credentials,
            noRetry: true
        })
        return response.user
    }

    /** Stops at `max`, at the reported total, or at a short page (Redmine may omit total_count). */
    private async paginate<T>(
        path: string,
        key: string,
        params: Params,
        max: number,
        rawQuery?: string
    ): Promise<Page<T>> {
        const items: T[] = []
        let total = 0
        for (let offset = 0; offset < max; offset += PAGE) {
            const limit = Math.min(PAGE, max - offset)
            const options = { params: { ...params, limit, offset }, rawQuery }
            const page = await this.http.request<PageResponse>('GET', path, options)
            const chunk = (page[key] as T[]) ?? []
            items.push(...chunk)
            total = page.total_count ?? items.length

            const reachedTotal = items.length >= total
            const isLastPage = chunk.length < limit
            if (reachedTotal || isLastPage) break
        }
        return { items, total }
    }

    listIssues(filter: IssueFilter, max = PAGE): Promise<Page<Issue>> {
        return this.paginate<Issue>('/issues.json', 'issues', issueParams(filter), max, filter.rawQuery)
    }

    async countIssues(filter: IssueFilter): Promise<number> {
        const params = { ...issueParams(filter), limit: 1 }
        const options = { params, rawQuery: filter.rawQuery }
        const response = await this.http.request<{ total_count: number }>('GET', '/issues.json', options)
        return response.total_count
    }

    private async issue(id: number, include: string): Promise<IssueDetail> {
        const response = await this.http.request<{ issue: IssueDto }>('GET', `/issues/${id}.json`, {
            params: { include }
        })
        return toDetail(response.issue)
    }

    getIssue(id: number) {
        return this.issue(id, FULL_ISSUE_INCLUDES)
    }

    getIssueWithJournals(id: number) {
        return this.issue(id, 'journals')
    }

    async allowedStatuses(issueId: number): Promise<IssueStatus[]> {
        const issue = await this.issue(issueId, 'allowed_statuses')
        return issue.allowed_statuses
    }

    async updateIssue(id: number, update: IssueUpdate): Promise<void> {
        const body = { issue: issueBody(update) }
        await this.http.request('PUT', `/issues/${id}.json`, { body })
    }

    async uploadFile(upload: IssueUpload): Promise<UploadedFile> {
        const params = { filename: upload.filename }
        const response = await this.http.upload<{ upload: { token: string } }>('/uploads.json', upload.bytes, params)
        return { token: response.upload.token, filename: upload.filename, contentType: upload.contentType }
    }

    async createIssue(issue: NewIssue, uploads: UploadedFile[] = []): Promise<Issue> {
        const body = { issue: newIssueBody(issue, uploads) }
        const response = await this.http.request<{ issue: Issue }>('POST', '/issues.json', { body })
        return response.issue
    }

    async listStatuses(): Promise<IssueStatus[]> {
        const response = await this.http.request<{ issue_statuses: IssueStatus[] }>('GET', '/issue_statuses.json')
        return response.issue_statuses
    }

    async listProjects(): Promise<Project[]> {
        const page = await this.paginate<Project>('/projects.json', 'projects', {}, MAX_LISTED_ITEMS)
        return page.items
    }

    async listSavedQueries(): Promise<SavedQuery[]> {
        const page = await this.paginate<SavedQuery>('/queries.json', 'queries', {}, MAX_LISTED_ITEMS)
        return page.items
    }

    async listProjectMembers(projectId: number): Promise<Named[]> {
        const path = `/projects/${projectId}/memberships.json`
        const page = await this.paginate<Membership>(path, 'memberships', {}, MAX_LISTED_ITEMS)
        const members = new Map<number, Named>()
        for (const membership of page.items) {
            const principal = membership.user ?? membership.group
            if (principal) members.set(principal.id, principal)
        }
        return [...members.values()]
    }

    async listProjectTrackers(projectId: number): Promise<Named[]> {
        const path = `/projects/${projectId}.json`
        const response = await this.http.request<{ project: { trackers?: Named[] } }>('GET', path, {
            params: { include: 'trackers' }
        })
        return response.project.trackers ?? []
    }

    async listTrackers(): Promise<Named[]> {
        const response = await this.http.request<{ trackers: Named[] }>('GET', '/trackers.json')
        return response.trackers
    }

    async listPriorities(): Promise<IssuePriority[]> {
        const response = await this.http.request<{ issue_priorities: IssuePriority[] }>(
            'GET',
            '/enumerations/issue_priorities.json'
        )
        return response.issue_priorities
    }

    /**
     * Up to 1000 entries: a week or an issue fits easily. Redmine compares `spent_on` with `from`/`to` moved by the
     * user's time zone: west of UTC the first day of the period was left out (Monday of "this week") and the day
     * after came in. So one more day is asked on each side and the result is cut back to the period.
     */
    async listTimeEntries(query: TimeEntryQuery): Promise<TimeEntry[]> {
        const params: Params = {
            user_id: query.mine ? 'me' : query.userId,
            issue_id: query.issueId,
            from: query.from && shiftDay(query.from, -1),
            to: query.to && shiftDay(query.to, 1)
        }
        const page = await this.paginate<TimeEntry>('/time_entries.json', 'time_entries', params, MAX_TIME_ENTRIES)
        return page.items.filter((entry) => isWithinPeriod(entry.spent_on, query))
    }

    async createTimeEntry(draft: TimeEntryDraft): Promise<TimeEntry> {
        const body = { time_entry: timeEntryBody(draft) }
        const response = await this.http.request<{ time_entry: TimeEntry }>('POST', '/time_entries.json', { body })
        return response.time_entry
    }

    async updateTimeEntry(id: number, draft: TimeEntryDraft): Promise<void> {
        await this.http.request('PUT', `/time_entries/${id}.json`, { body: { time_entry: timeEntryBody(draft) } })
    }

    async deleteTimeEntry(id: number): Promise<void> {
        await this.http.request('DELETE', `/time_entries/${id}.json`)
    }

    async listTimeEntryActivities(): Promise<TimeEntryActivity[]> {
        const response = await this.http.request<{ time_entry_activities: TimeEntryActivity[] }>(
            'GET',
            '/enumerations/time_entry_activities.json'
        )
        return response.time_entry_activities
    }

    async getAttachment(id: number): Promise<Attachment> {
        const response = await this.http.request<{ attachment: Attachment }>('GET', `/attachments/${id}.json`)
        return response.attachment
    }

    /** Built from the id on the configured Redmine, never from `content_url`, which could point anywhere. */
    downloadAttachment(id: number, maxBytes: number): Promise<Uint8Array> {
        return this.http.download(`/attachments/download/${id}`, maxBytes)
    }

    async listVersions(projectId: number): Promise<Version[]> {
        const path = `/projects/${projectId}/versions.json`
        const response = await this.http.request<{ versions: Version[] }>('GET', path)
        return response.versions
    }
}
