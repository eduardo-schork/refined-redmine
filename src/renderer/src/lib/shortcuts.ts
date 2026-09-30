const IS_MAC = navigator.userAgent.includes('Mac')

/** Label of the quick search shortcut as the user types it on this system. */
export const SEARCH_SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl K'
