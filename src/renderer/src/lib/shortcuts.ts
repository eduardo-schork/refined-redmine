import { useEffect } from 'react'

const IS_MAC = navigator.userAgent.includes('Mac')

/** Label of the quick search shortcut as the user types it on this system. */
export const SEARCH_SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl K'

/** Label of the "new issue" shortcut. */
export const NEW_ISSUE_SHORTCUT = IS_MAC ? '⌘N' : 'Ctrl N'

/** Label of "save" in multi-line editors (⌘/Ctrl + Enter). */
export const SUBMIT_SHORTCUT = IS_MAC ? '⌘↵' : 'Ctrl+Enter'

/** ⌘ + key on macOS, Ctrl + key on Windows, from any screen. */
export function useModifierShortcut(key: string, action: () => void) {
    useEffect(() => {
        const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
            const withModifier = keyboardEvent.metaKey || keyboardEvent.ctrlKey
            if (!withModifier || keyboardEvent.key.toLowerCase() !== key) return
            keyboardEvent.preventDefault()
            action()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [key, action])
}
