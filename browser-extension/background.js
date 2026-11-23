import { handoffPage, isIssueUrl, loadSettings } from './redmine.js'

const MENU_ID = 'open-in-app'

// Tabs opened by another app (a link clicked in Slack or an e-mail) have no opener tab. Their first navigation
// decides: an issue of the Redmine goes to the app. Links followed inside the browser keep working as usual.
const freshTabs = new Set()

chrome.tabs.onCreated.addListener((tab) => {
    if (tab.openerTabId === undefined) freshTabs.add(tab.id)
})

chrome.tabs.onRemoved.addListener((tabId) => freshTabs.delete(tabId))

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0 || !freshTabs.has(details.tabId)) return
    freshTabs.delete(details.tabId)
    const { base, autoOpen } = await loadSettings()
    if (!autoOpen || !isIssueUrl(details.url, base)) return
    await chrome.tabs.update(details.tabId, { url: handoffPage(details.url) })
})

async function openInApp(url) {
    const { base } = await loadSettings()
    if (!isIssueUrl(url, base)) {
        await chrome.runtime.openOptionsPage()
        return
    }
    await chrome.tabs.create({ url: handoffPage(url) })
}

chrome.action.onClicked.addListener((tab) => openInApp(tab.url ?? ''))

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === MENU_ID) openInApp(info.linkUrl ?? '')
})

/** Match patterns ignore the port, so the menu shows for the host and `openInApp` checks the whole address. */
function issueLinkPattern(base) {
    const url = new URL(base)
    return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/+$/, '')}/issues/*`
}

async function updateMenu() {
    await chrome.contextMenus.removeAll()
    const { base } = await loadSettings()
    if (!base) return
    chrome.contextMenus.create({
        id: MENU_ID,
        title: chrome.i18n.getMessage('openInApp'),
        contexts: ['link'],
        targetUrlPatterns: [issueLinkPattern(base)]
    })
}

chrome.runtime.onInstalled.addListener(async (details) => {
    await updateMenu()
    const { base } = await loadSettings()
    if (details.reason === 'install' && !base) await chrome.runtime.openOptionsPage()
})

chrome.storage.onChanged.addListener((changes) => {
    if (changes.redmineUrl) updateMenu()
})
