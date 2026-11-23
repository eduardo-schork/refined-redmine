/** The Redmine address saved in the options, without a trailing slash; '' until it is set. */
export async function loadSettings() {
    const { redmineUrl = '', autoOpen = true } = await chrome.storage.sync.get(['redmineUrl', 'autoOpen'])
    return { base: normalizeBaseUrl(redmineUrl), autoOpen }
}

export const normalizeBaseUrl = (url) => url.trim().replace(/\/+$/, '')

// Same rule as RedmineLinks.resolve in the app (src/domain/redmine/links.ts): an issue page, maybe at a note.
const ISSUE_PATH = /^\/issues\/\d+\/?(?:\?[^#]*)?(?:#.*)?$/

export function isIssueUrl(url, base) {
    if (!base || !url || !url.startsWith(base)) return false
    return ISSUE_PATH.test(url.slice(base.length))
}

/** The extension page that hands the link to the app and closes once the app takes the focus. */
export const handoffPage = (url) => chrome.runtime.getURL(`handoff.html?url=${encodeURIComponent(url)}`)
