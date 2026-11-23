import { localize } from './page.js'

localize()
const url = new URLSearchParams(location.search).get('url') ?? ''
document.getElementById('browser').href = url

// Once the app opens, the browser loses the focus to it and this tab is no longer needed. The browser's own
// "Open Refined Redmine?" prompt does not take the focus away from the browser, so it is not cut short.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) return
    const tab = await chrome.tabs.getCurrent()
    if (tab?.id !== undefined) await chrome.tabs.remove(tab.id)
})

location.href = `refined-redmine://open?url=${encodeURIComponent(url)}`
