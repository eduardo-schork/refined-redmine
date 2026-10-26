/** Order of the issue history: oldest first (like Redmine) or newest first. Per computer. */
export type JournalOrder = 'oldest' | 'newest'

const STORAGE_KEY = 'refined-redmine.journal-order'

export function loadJournalOrder(): JournalOrder {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'newest' ? 'newest' : 'oldest'
    } catch {
        return 'oldest'
    }
}

export function saveJournalOrder(order: JournalOrder): void {
    try {
        localStorage.setItem(STORAGE_KEY, order)
    } catch {
        // Storage unavailable: the history opens oldest first next time.
    }
}
