export interface Named {
    id: number
    name: string
}

export interface RedmineUser {
    id: number
    login: string
    firstname: string
    lastname: string
    mail?: string
}

export interface IssueStatus extends Named {
    is_closed: boolean
}

export interface Issue {
    id: number
    project: Named
    tracker: Named
    status: IssueStatus
    priority: Named
    author: Named
    assigned_to?: Named
    fixed_version?: Named
    subject: string
    start_date?: string | null
    due_date?: string | null
    done_ratio: number
    estimated_hours?: number | null
    created_on: string
    updated_on: string
    closed_on?: string | null
    custom_fields?: CustomFieldValue[]
    parent?: { id: number }
}

export interface JournalDetail {
    property: 'attr' | 'cf' | 'attachment' | 'relation'
    name: string
    old_value?: string | null
    new_value?: string | null
}

export interface Journal {
    id: number
    user: Named
    notes?: string | null
    created_on: string
    private_notes?: boolean
    details: JournalDetail[]
}

export interface CustomFieldValue {
    id: number
    name: string
    value: string | string[] | null
}

export interface Attachment {
    id: number
    filename: string
    filesize: number
    content_type?: string
    author: Named
    created_on: string
}

export interface Relation {
    id: number
    issue_id: number
    issue_to_id: number
    relation_type: string
    delay?: number | null
}

export interface IssueDetail extends Issue {
    description?: string | null
    spent_hours?: number
    journals: Journal[]
    attachments: Attachment[]
    relations: Relation[]
    children: { id: number; tracker: Named; subject: string }[]
    watchers: Named[]
    allowed_statuses: IssueStatus[]
}

export interface Version extends Named {
    project: Named
    description: string
    status: 'open' | 'locked' | 'closed'
    due_date: string | null
    sharing: string
    custom_fields?: CustomFieldValue[]
}

export interface SavedQuery extends Named {
    is_public: boolean
    project_id?: number | null
}

export interface IssuePriority extends Named {
    is_default: boolean
    active?: boolean
}

export interface Project extends Named {
    identifier: string
    parent?: Named
}

export interface Page<T> {
    items: T[]
    total: number
}

export const displayName = (user: Pick<RedmineUser, 'firstname' | 'lastname'>) =>
    `${user.firstname} ${user.lastname}`.trim()
