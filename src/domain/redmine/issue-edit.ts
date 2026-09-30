import { AppError } from '../shared/errors'
import type { LocalDate } from '../shared/date'
import type { IssueDetail } from './entities'

/** Fields editable from the issue screen. null clears the field; a missing key leaves it as it is. */
export interface IssueFieldsChange {
    assignedToId?: number | null
    fixedVersionId?: number | null
    priorityId?: number
    startDate?: LocalDate | null
    dueDate?: LocalDate | null
    doneRatio?: number
}

export type EditableField = keyof IssueFieldsChange

export const DONE_RATIO_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const CURRENT_VALUE: Record<EditableField, (issue: IssueDetail) => number | string | null> = {
    assignedToId: (issue) => issue.assigned_to?.id ?? null,
    fixedVersionId: (issue) => issue.fixed_version?.id ?? null,
    priorityId: (issue) => issue.priority.id,
    startDate: (issue) => issue.start_date ?? null,
    dueDate: (issue) => issue.due_date ?? null,
    doneRatio: (issue) => issue.done_ratio
}

/** Throws the first problem with the change, considering the dates the issue already has. */
export function assertValidChange(issue: IssueDetail, change: IssueFieldsChange): void {
    const start = change.startDate === undefined ? issue.start_date : change.startDate
    const due = change.dueDate === undefined ? issue.due_date : change.dueDate
    if (start && due && start > due) throw new AppError('issue.datesOrder')

    const ratio = change.doneRatio
    const invalidRatio = ratio !== undefined && (!Number.isInteger(ratio) || ratio < 0 || ratio > 100)
    if (invalidRatio) throw new AppError('issue.doneRatio')
}

/**
 * Fields whose saved value differs from the requested one. Redmine silently ignores changes to fields that the
 * workflow makes read-only for the user, so the issue is read again after saving and compared.
 */
export function ignoredFields(change: IssueFieldsChange, saved: IssueDetail): EditableField[] {
    const fields = Object.keys(change) as EditableField[]
    return fields.filter((field) => CURRENT_VALUE[field](saved) !== (change[field] ?? null))
}
