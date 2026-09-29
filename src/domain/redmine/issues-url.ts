import { AppError } from '../shared/errors'

/** Issue list filter copied from a Redmine page URL (…/issues?set_filter=1&f[]=…). */
export interface IssuesUrlFilter {
    /** Query string sent to /issues.json, without paging and display parameters. */
    query: string
    /** Project identifier taken from /projects/<identifier>/issues. */
    projectRef?: string
}

const ISSUES_PATH = /(?:\/projects\/([^/]+))?\/issues(?:\.json)?\/?$/
const PLACEHOLDER_ORIGIN = 'http://redmine.local'

// Paging is controlled by the app; `key` would leak an API key pasted by mistake.
const IGNORED_PARAMETERS = new Set(['key', 'page', 'per_page', 'offset', 'limit', 'format', 'utf8', 'commit'])

function parseUrl(input: string): URL {
    try {
        return new URL(input.trim(), PLACEHOLDER_ORIGIN)
    } catch {
        throw new AppError('filter.invalidUrl')
    }
}

function keptParameters(url: URL): URLSearchParams {
    const kept = new URLSearchParams()
    for (const [name, value] of url.searchParams) {
        if (!IGNORED_PARAMETERS.has(name)) kept.append(name, value)
    }
    return kept
}

/**
 * Accepts the address of any Redmine issue list (saved query or ad-hoc filters), with or without the host.
 * The same parameters work on /issues.json, so they are forwarded as they are.
 */
export function parseIssuesUrl(input: string): IssuesUrlFilter {
    if (!input.trim()) throw new AppError('filter.invalidUrl')
    const url = parseUrl(input)
    const match = url.pathname.match(ISSUES_PATH)
    if (!match) throw new AppError('filter.invalidUrl')

    const parameters = keptParameters(url)
    const projectRef = match[1] ? decodeURIComponent(match[1]) : undefined
    const hasProjectParameter = parameters.has('project_id')
    if (projectRef && !hasProjectParameter) parameters.set('project_id', projectRef)
    return { query: parameters.toString(), projectRef }
}

/** Web page of the filter, for "Open in Redmine". */
export function issuesPageUrl(baseUrl: string, filter: IssuesUrlFilter): string {
    const path = filter.projectRef ? `/projects/${encodeURIComponent(filter.projectRef)}/issues` : '/issues'
    const query = filter.query ? `?${filter.query}` : ''
    return `${baseUrl}${path}${query}`
}
