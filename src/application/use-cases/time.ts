import type { Issue } from '@domain/redmine/entities'
import type { LocalDate } from '@domain/shared/date'
import { assertValidDraft, type TimeEntry, type TimeEntryDraft } from '@domain/time/time-entry'
import { shiftedEntries } from '@domain/time/timesheet'
import type { MyTimeEntries } from '../dto'
import type { RedmineGateway } from '../ports/redmine-gateway'
import { issuesByIds } from './issue-lookup'

const DAYS_IN_WEEK = 7

const newestFirst = (first: TimeEntry, second: TimeEntry) =>
    second.spent_on.localeCompare(first.spent_on) || second.id - first.id

/** Issues of the entries, to show their titles next to the hours (time entries only carry the issue id). */
async function issuesById(gateway: RedmineGateway, entries: TimeEntry[]): Promise<Record<number, Issue>> {
    const ids = entries.flatMap((entry) => (entry.issue ? [entry.issue.id] : []))
    const issues = await issuesByIds(gateway, ids)
    return Object.fromEntries(issues.map((issue) => [issue.id, issue]))
}

export class TimeQueries {
    constructor(private readonly gateway: RedmineGateway) {}

    async forIssue(issueId: number): Promise<TimeEntry[]> {
        const entries = await this.gateway.listTimeEntries({ issueId })
        return entries.sort(newestFirst)
    }

    /** The signed-in user's entries between two dates, with the issues they belong to. */
    async mine(from: LocalDate, to: LocalDate): Promise<MyTimeEntries> {
        const entries = await this.gateway.listTimeEntries({ mine: true, from, to })
        const sorted = entries.sort(newestFirst)
        return { entries: sorted, issues: await issuesById(this.gateway, sorted) }
    }
}

export class LogTimeUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    async execute(draft: TimeEntryDraft): Promise<TimeEntry> {
        const clean = { ...draft, comments: draft.comments.trim() }
        assertValidDraft(clean)
        return this.gateway.createTimeEntry(clean)
    }
}

export class EditTimeEntryUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    async execute(id: number, draft: TimeEntryDraft): Promise<void> {
        const clean = { ...draft, comments: draft.comments.trim() }
        assertValidDraft(clean)
        return this.gateway.updateTimeEntry(id, clean)
    }
}

export class DeleteTimeEntryUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    execute(id: number): Promise<void> {
        return this.gateway.deleteTimeEntry(id)
    }
}

/**
 * "Repeat last week": the signed-in user's entries of the previous week, logged again on the same weekdays of the
 * following week (same issue, hours, activity and comment). Entries without an issue are skipped.
 * One at a time, so a refusal in the middle keeps what was already logged and says how far it went.
 */
export class RepeatWeekUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    async execute(previousWeekStart: LocalDate, previousWeekEnd: LocalDate): Promise<number> {
        const previous = await this.gateway.listTimeEntries({
            mine: true,
            from: previousWeekStart,
            to: previousWeekEnd
        })
        const withIssue = previous.filter((entry) => entry.issue)
        const shifted = shiftedEntries(withIssue, DAYS_IN_WEEK)
        let created = 0
        for (const { entry, spentOn } of shifted) {
            await this.gateway.createTimeEntry({
                issueId: entry.issue!.id,
                spentOn,
                hours: entry.hours,
                activityId: entry.activity.id,
                comments: entry.comments
            })
            created += 1
        }
        return created
    }
}
