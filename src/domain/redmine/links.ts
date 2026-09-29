/** Redmine web UI addresses (for "Open in Redmine" and links in texts). */
export class RedmineLinks {
    readonly base: string

    constructor(baseUrl: string) {
        this.base = normalizeBaseUrl(baseUrl)
    }

    issue(id: number): string {
        return `${this.base}/issues/${id}`
    }

    attachment(id: number): string {
        return `${this.base}/attachments/${id}`
    }

    query(queryId: number, projectId?: number): string {
        if (projectId) return `${this.base}/projects/${projectId}/issues?query_id=${queryId}`
        return `${this.base}/issues?query_id=${queryId}`
    }

    /** Resolves relative links in Redmine texts. Returns the id if it is a link to an issue. */
    resolve(href: string): { url: string; issueId?: number } {
        const url = absoluteUrl(this.base, href)
        return { url, issueId: issueIdOf(this.base, url) }
    }
}

const ISSUE_PATH = /^\/issues\/(\d+)\/?(?:[?#].*)?$/

function absoluteUrl(base: string, href: string): string {
    if (isHttpUrl(href)) return href
    const separator = href.startsWith('/') ? '' : '/'
    return `${base}${separator}${href}`
}

function issueIdOf(base: string, url: string): number | undefined {
    if (!url.startsWith(base)) return undefined
    const path = url.slice(base.length)
    const match = path.match(ISSUE_PATH)
    return match ? Number(match[1]) : undefined
}

export function normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '')
}

export const isHttpUrl = (url: string) => /^https?:\/\//i.test(url)
