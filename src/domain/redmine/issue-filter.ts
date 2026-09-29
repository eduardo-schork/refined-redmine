export interface IssueFilter {
    assignedTo?: 'me'
    watcher?: 'me'
    author?: 'me'
    /** 'open' | 'closed' | '*' (all) | list of statuses */
    status?: 'open' | 'closed' | '*' | number[]
    project?: { id: number; includeSubprojects: boolean }
    queryId?: number
    queryProjectId?: number
    /** Parameters copied from a Redmine page URL (see issues-url.ts). Like queryId, it replaces the other fields. */
    rawQuery?: string
    versionId?: number
    /** Updated since this instant (ISO, server clock). */
    updatedSince?: string
    sort?: 'priority' | 'updated' | 'updatedDesc' | 'id'
}

export const MY_OPEN_QUEUE: IssueFilter = { assignedTo: 'me', status: 'open', sort: 'priority' }
