import { AppError } from '../shared/errors'
import type { LocalDate } from '../shared/date'
import type { IssueDetail } from './entities'

/** Fields editable from the issue screen. null clears the field; a missing key leaves it as it is. */
export interface IssueFieldsChange {
    subject?: string
    description?: string
    trackerId?: number
    assignedToId?: number | null
    fixedVersionId?: number | null
    priorityId?: number
    startDate?: LocalDate | null
    dueDate?: LocalDate | null
    doneRatio?: number
    estimatedHours?: number | null
    parentIssueId?: number | null
}

export type EditableField = keyof IssueFieldsChange

/** A new issue. Without a tracker or priority, Redmine uses the project's first tracker and the default priority. */
export interface NewIssue {
    projectId: number
    trackerId?: number
    subject: string
    description?: string
    priorityId?: number
    assignedToId?: number
    fixedVersionId?: number
    startDate?: LocalDate
    dueDate?: LocalDate
    estimatedHours?: number
    parentIssueId?: number
}

/** What a screen already knows about the issue being created (a board's project and sprint, a parent issue). */
export type NewIssueDefaults = Partial<Pick<NewIssue, 'projectId' | 'fixedVersionId' | 'parentIssueId'>>

/** A subtask starts in the parent's project and version. */
export function subtaskDefaults(parent: Pick<IssueDetail, 'id' | 'project' | 'fixed_version'>): NewIssueDefaults {
    return { projectId: parent.project.id, fixedVersionId: parent.fixed_version?.id, parentIssueId: parent.id }
}

export const DONE_RATIO_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

/** Redmine's limit for the issue title. */
export const MAX_SUBJECT_LENGTH = 255

/** Redmine has no limit; this only catches typos such as an extra zero or two. */
export const MAX_ESTIMATED_HOURS = 9999

/** Redmine may store line breaks as \r\n and drop trailing blank lines: compared without both. */
function comparableText(text: string | null | undefined): string | null {
    const normalized = (text ?? '').replace(/\r\n/g, '\n').trimEnd()
    return normalized || null
}

const CURRENT_VALUE: Record<EditableField, (issue: IssueDetail) => number | string | null> = {
    subject: (issue) => issue.subject,
    description: (issue) => comparableText(issue.description),
    trackerId: (issue) => issue.tracker.id,
    assignedToId: (issue) => issue.assigned_to?.id ?? null,
    fixedVersionId: (issue) => issue.fixed_version?.id ?? null,
    priorityId: (issue) => issue.priority.id,
    startDate: (issue) => issue.start_date ?? null,
    dueDate: (issue) => issue.due_date ?? null,
    doneRatio: (issue) => issue.done_ratio,
    estimatedHours: (issue) => issue.estimated_hours ?? null,
    parentIssueId: (issue) => issue.parent?.id ?? null
}

function requestedValue(change: IssueFieldsChange, field: EditableField): number | string | null {
    if (field === 'description') return comparableText(change.description)
    return change[field] ?? null
}

function assertValidSubject(subject: string): void {
    const trimmed = subject.trim()
    if (!trimmed) throw new AppError('issue.subjectRequired')
    if (trimmed.length > MAX_SUBJECT_LENGTH) throw new AppError('issue.subjectTooLong', { max: MAX_SUBJECT_LENGTH })
}

function assertDatesInOrder(start: string | null | undefined, due: string | null | undefined): void {
    if (start && due && start > due) throw new AppError('issue.datesOrder')
}

function assertValidEstimate(hours: number | null | undefined): void {
    if (hours === null || hours === undefined) return
    const valid = Number.isFinite(hours) && hours >= 0 && hours <= MAX_ESTIMATED_HOURS
    if (!valid) throw new AppError('issue.estimatedHours', { max: MAX_ESTIMATED_HOURS })
}

const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0

/** Redmine checks the rest (an issue that does not exist, a loop of parents, another project). */
function assertValidParent(parentId: number | null | undefined, issueId?: number): void {
    if (parentId === null || parentId === undefined) return
    const valid = isPositiveInteger(parentId) && parentId !== issueId
    if (!valid) throw new AppError('issue.invalidParent')
}

function assertValidDoneRatio(ratio: number | undefined): void {
    const invalid = ratio !== undefined && (!Number.isInteger(ratio) || ratio < 0 || ratio > 100)
    if (invalid) throw new AppError('issue.doneRatio')
}

/** Throws the first problem with the change, considering the dates the issue already has. */
export function assertValidChange(issue: IssueDetail, change: IssueFieldsChange): void {
    if (change.subject !== undefined) assertValidSubject(change.subject)

    const start = change.startDate === undefined ? issue.start_date : change.startDate
    const due = change.dueDate === undefined ? issue.due_date : change.dueDate
    assertDatesInOrder(start, due)

    assertValidDoneRatio(change.doneRatio)
    assertValidEstimate(change.estimatedHours)
    assertValidParent(change.parentIssueId, issue.id)
}

/** Throws the first problem with a new issue. */
export function assertValidNewIssue(issue: NewIssue): void {
    if (!isPositiveInteger(issue.projectId)) throw new AppError('issue.projectRequired')
    assertValidSubject(issue.subject)
    assertDatesInOrder(issue.startDate, issue.dueDate)
    assertValidEstimate(issue.estimatedHours)
    assertValidParent(issue.parentIssueId)
}

/**
 * Fields whose saved value differs from the requested one. Redmine silently ignores changes to fields that the
 * workflow makes read-only for the user, so the issue is read again after saving and compared.
 */
export function ignoredFields(change: IssueFieldsChange, saved: IssueDetail): EditableField[] {
    const fields = Object.keys(change) as EditableField[]
    return fields.filter((field) => CURRENT_VALUE[field](saved) !== requestedValue(change, field))
}
