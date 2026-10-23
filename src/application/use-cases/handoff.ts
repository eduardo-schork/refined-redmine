import { MAX_NEARBY_READS, neighbourIds, type NearbyIssue } from '@domain/automation/handoff'
import type { IssueDetail } from '@domain/redmine/entities'
import {
    bulkDiff,
    isEmptyChange,
    unappliedFields,
    type IssueNoteChange,
    type BulkEditResult
} from '@domain/redmine/issue-tree'
import { assertValidUploads, cleanUpload, type IssueUpload, type UploadedFile } from '@domain/redmine/issue-upload'
import type { RedmineGateway } from '../ports/redmine-gateway'

/** With trackers to find, up to 4 links away; without, the immediate surroundings. */
const DEPTH_FINDING_TRACKERS = 4
const DEPTH_WITHOUT_TRACKERS = 2

/**
 * Issues around the opened one (parent, subtasks, relations, and theirs), closest first, read with their journals.
 * Stops at the first depth where every wanted tracker was found, at the depth limit or after 60 reads; issues the
 * user cannot see are skipped.
 */
export async function findNearbyIssues(
    gateway: RedmineGateway,
    issueId: number,
    wantedTrackerIds: number[]
): Promise<NearbyIssue[]> {
    const maxDepth = wantedTrackerIds.length ? DEPTH_FINDING_TRACKERS : DEPTH_WITHOUT_TRACKERS
    const seen = new Set([issueId])
    const found: NearbyIssue[] = []
    let frontier = [await gateway.getIssue(issueId)]
    let reads = 1
    const allFound = () => wantedTrackerIds.every((id) => found.some((nearby) => nearby.issue.tracker.id === id))
    for (let depth = 1; depth <= maxDepth && frontier.length && reads < MAX_NEARBY_READS; depth++) {
        const ids = [...new Set(frontier.flatMap(neighbourIds))].filter((id) => !seen.has(id))
        const next: IssueDetail[] = []
        for (const id of ids.slice(0, MAX_NEARBY_READS - reads)) {
            seen.add(id)
            reads += 1
            const issue = await readIfVisible(gateway, id)
            if (!issue) continue
            found.push({ issue, depth })
            next.push(issue)
        }
        if (wantedTrackerIds.length && allFound()) break
        frontier = next
    }
    return found
}

async function readIfVisible(gateway: RedmineGateway, id: number): Promise<IssueDetail | undefined> {
    try {
        return await gateway.getIssue(id)
    } catch {
        return undefined
    }
}

export class CommentAndChangeUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    /**
     * Only the fields that differ are sent, with the comment and the files in the same update; the issue is read
     * again because Redmine silently ignores what the workflow does not allow.
     */
    async execute(issueId: number, change: IssueNoteChange, uploads: IssueUpload[] = []): Promise<BulkEditResult> {
        assertValidUploads(uploads)
        const notes = change.notes?.trim() || undefined
        const current = await this.gateway.getIssue(issueId)
        const diff = bulkDiff(current, change)
        if (isEmptyChange(diff) && !notes && !uploads.length) return { outcome: 'unchanged', ignored: [] }
        const uploaded: UploadedFile[] = []
        for (const upload of uploads) uploaded.push(await this.gateway.uploadFile(cleanUpload(upload)))
        await this.gateway.updateIssue(issueId, { ...diff, notes, uploads: uploaded.length ? uploaded : undefined })
        const saved = await this.gateway.getIssue(issueId)
        const ignored = unappliedFields(diff, saved)
        return { outcome: ignored.length ? 'partial' : 'applied', ignored }
    }
}
