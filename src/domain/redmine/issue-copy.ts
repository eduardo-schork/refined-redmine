/** What the quick actions of the issue detail copy to the clipboard. */
export type CopyFormat = 'link' | 'number' | 'title' | 'reference' | 'markdown'

export const COPY_FORMATS: CopyFormat[] = ['link', 'number', 'title', 'reference', 'markdown']

interface CopyableIssue {
    id: number
    subject: string
}

/** "#1234 Title" is how the team refers to an issue in chats and commits. */
export function copyText(format: CopyFormat, issue: CopyableIssue, url: string): string {
    const reference = `#${issue.id} ${issue.subject.trim()}`
    const texts: Record<CopyFormat, string> = {
        link: url,
        number: `#${issue.id}`,
        title: issue.subject.trim(),
        reference,
        // Square brackets in the title would close the link text early.
        markdown: `[${reference.replace(/[[\]]/g, '\\$&')}](${url})`
    }
    return texts[format]
}
