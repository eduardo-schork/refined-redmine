// "#1234", "#1234#note-5" and "#1234-5" (3+ digits, at line start or after space/parenthesis), as Redmine links them.
const ISSUE_REFERENCE = /(^|[\s(])(#(\d{3,})(?:#note-(\d+)|-(\d+))?)\b/g
// "#note-5": a note of the issue the text belongs to.
const NOTE_REFERENCE = /(^|[\s(])(#note-(\d+))\b/g

const issueLink = (issueId: string | number, note?: string) => {
    if (!note) return `/issues/${issueId}`
    return `/issues/${issueId}#note-${note}`
}

/** Turns Redmine issue and note references in a text into Markdown links, keeping what was written as the label. */
export function linkIssueReferences(text: string, currentIssueId?: number): string {
    const withIssues = text.replace(
        ISSUE_REFERENCE,
        (_match, prefix: string, label: string, issueId: string, noteAfterHash?: string, noteAfterDash?: string) =>
            `${prefix}[${label}](${issueLink(issueId, noteAfterHash ?? noteAfterDash)})`
    )
    if (!currentIssueId) return withIssues
    return withIssues.replace(
        NOTE_REFERENCE,
        (_match, prefix: string, label: string, note: string) =>
            `${prefix}[${label}](${issueLink(currentIssueId, note)})`
    )
}
