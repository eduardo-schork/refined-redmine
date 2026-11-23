/** Fills the elements marked with data-i18n with the extension's messages. */
export function localize() {
    document.documentElement.lang = chrome.i18n.getUILanguage()
    for (const element of document.querySelectorAll('[data-i18n]')) {
        element.textContent = chrome.i18n.getMessage(element.dataset.i18n)
    }
}
