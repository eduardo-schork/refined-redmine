import type { ErrorCode } from '../shared/errors'

/** Redmine pages people copy from the browser instead of the base address. */
const PAGE_SUFFIX = /\/(my\/account|login|issues(\/.*)?|projects(\/.*)?|my\/page)$/i
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * The address typed on the connection screen, ready to use: https:// when no scheme was typed, without a pasted
 * Redmine page (/my/account, /issues/123…) and without trailing slashes. A Redmine under a sub-path
 * (https://host/redmine) keeps the sub-path.
 */
export function prepareBaseUrl(typed: string): string {
    const trimmed = typed.trim()
    if (!trimmed) return ''
    const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
    const withoutQuery = withScheme.replace(/[?#].*$/, '')
    return withoutQuery.replace(/\/+$/, '').replace(PAGE_SUFFIX, '').replace(/\/+$/, '')
}

/** Host shown in "Connecting to …". */
export function hostOf(url: string): string {
    try {
        return new URL(url).host
    } catch {
        return url
    }
}

/**
 * On the connection screen some Redmine answers mean something more specific than in the rest of the app:
 * /my/account missing (404) or answering a non-JSON page means the address is not a Redmine (or not its root),
 * and 403 means the REST API is switched off in that Redmine.
 */
const LOGIN_ERROR_CODES: Partial<Record<ErrorCode, ErrorCode>> = {
    'redmine.unauthorized': 'auth.invalidKey',
    'redmine.notFound': 'auth.notRedmine',
    'redmine.invalidResponse': 'auth.notRedmine',
    'redmine.forbidden': 'auth.apiDisabled'
}

export function loginErrorCode(code: ErrorCode): ErrorCode {
    return LOGIN_ERROR_CODES[code] ?? code
}
