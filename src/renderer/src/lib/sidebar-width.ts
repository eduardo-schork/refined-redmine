/** Width of the sidebar, dragged by its right edge (long board names). Per computer. */
export const SIDEBAR_DEFAULT_WIDTH = 240
export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 480

const STORAGE_KEY = 'refined-redmine.sidebar-width'

export const clampSidebarWidth = (width: number) =>
    Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)))

export function loadSidebarWidth(): number {
    try {
        const saved = Number(localStorage.getItem(STORAGE_KEY))
        return saved ? clampSidebarWidth(saved) : SIDEBAR_DEFAULT_WIDTH
    } catch {
        return SIDEBAR_DEFAULT_WIDTH
    }
}

export function saveSidebarWidth(width: number): void {
    try {
        localStorage.setItem(STORAGE_KEY, String(width))
    } catch {
        // Storage unavailable: the sidebar opens with the default width next time.
    }
}
