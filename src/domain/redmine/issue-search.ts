export type IssueSearch = { type: 'empty' } | { type: 'id'; id: number } | { type: 'text'; term: string }

export const MIN_SEARCH_LENGTH = 2
export const MAX_SEARCH_RESULTS = 20

/** "#1234" or "1234" opens that issue; two or more characters search the titles. */
export function parseIssueSearch(input: string): IssueSearch {
    const trimmed = input.trim()
    const idMatch = trimmed.match(/^#?(\d+)$/)
    if (idMatch) return { type: 'id', id: Number(idMatch[1]) }
    if (trimmed.length < MIN_SEARCH_LENGTH) return { type: 'empty' }
    return { type: 'text', term: trimmed }
}

/**
 * Title search in any status, most recently updated first. Redmine only combines filters given as
 * f[]/op[]/v[] (a plain status_id would be ignored next to them), so both filters use that form.
 */
export function titleSearchQuery(term: string): string {
    const query = new URLSearchParams()
    query.set('set_filter', '1')
    query.append('f[]', 'status_id')
    query.set('op[status_id]', '*')
    query.append('f[]', 'subject')
    query.set('op[subject]', '~')
    query.append('v[subject][]', term)
    query.set('sort', 'updated_on:desc')
    return query.toString()
}
