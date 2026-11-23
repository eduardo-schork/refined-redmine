/** Redmine web UI addresses (for "Open in Redmine" and links in texts). */
export class RedmineLinks {
    readonly base: string

    constructor(baseUrl: string) {
        this.base = normalizeBaseUrl(baseUrl)
    }

    issue(id: number): string {
        return `${this.base}/issues/${id}`
    }

    /** A note of the issue, numbered as in the Redmine history (#1, #2…). */
    note(issueId: number, note: number): string {
        return `${this.issue(issueId)}#note-${note}`
    }

    attachment(id: number): string {
        return `${this.base}/attachments/${id}`
    }

    query(queryId: number, projectId?: number): string {
        if (projectId) return `${this.base}/projects/${projectId}/issues?query_id=${queryId}`
        return `${this.base}/issues?query_id=${queryId}`
    }

    /** Resolves relative links in Redmine texts. Returns the id if it is a link to an issue, and the note it points to. */
    resolve(href: string): { url: string } & IssueTarget {
        const url = absoluteUrl(this.base, href)
        return { url, ...issueTargetOf(this.base, url) }
    }
}

export interface IssueTarget {
    issueId?: number
    note?: number
}

const ISSUE_PATH = /^\/issues\/(\d+)\/?(?:\?[^#]*)?(?:#(.*))?$/
const NOTE_ANCHOR = /^note-(\d+)$/

function absoluteUrl(base: string, href: string): string {
    if (isHttpUrl(href)) return href
    const separator = href.startsWith('/') ? '' : '/'
    return `${base}${separator}${href}`
}

function issueTargetOf(base: string, url: string): IssueTarget {
    if (!url.startsWith(base)) return {}
    const path = url.slice(base.length)
    const match = path.match(ISSUE_PATH)
    if (!match) return {}
    const note = match[2]?.match(NOTE_ANCHOR)?.[1]
    return { issueId: Number(match[1]), note: note ? Number(note) : undefined }
}

export function normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '')
}

export const isHttpUrl = (url: string) => /^https?:\/\//i.test(url)

export const APP_LINK_SCHEME = 'refined-redmine'

/**
 * `refined-redmine://open?url=<Redmine link>` (from the browser extension or a bookmark) opens that issue, at the note,
 * in the app. Any web page can open such a link, so only issues of the configured Redmine are accepted.
 */
export function appLinkTarget(appUrl: string, links: RedmineLinks): { issueId: number; note?: number } | undefined {
    if (!links.base) return undefined
    let parsed: URL
    try {
        parsed = new URL(appUrl)
    } catch {
        return undefined
    }
    if (parsed.protocol !== `${APP_LINK_SCHEME}:` || parsed.hostname !== 'open') return undefined
    const redmineUrl = parsed.searchParams.get('url')
    if (!redmineUrl || !isHttpUrl(redmineUrl)) return undefined
    const { issueId, note } = links.resolve(redmineUrl)
    if (!issueId) return undefined
    return { issueId, note }
}
