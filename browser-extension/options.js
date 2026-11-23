import { localize } from './page.js'
import { loadSettings, normalizeBaseUrl } from './redmine.js'

localize()
const form = document.getElementById('form')
const redmineUrl = document.getElementById('redmineUrl')
const autoOpen = document.getElementById('autoOpen')
const status = document.getElementById('status')

const settings = await loadSettings()
redmineUrl.value = settings.base
autoOpen.checked = settings.autoOpen

form.addEventListener('submit', async (event) => {
    event.preventDefault()
    await chrome.storage.sync.set({ redmineUrl: normalizeBaseUrl(redmineUrl.value), autoOpen: autoOpen.checked })
    status.textContent = chrome.i18n.getMessage('saved')
})
