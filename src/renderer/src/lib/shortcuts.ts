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

/** Modifier of "go to tab N" as shown to the user (⌘1 on macOS, Ctrl+1 on Windows). */
export const TAB_NUMBER_MODIFIER = IS_MAC ? '⌘' : 'Ctrl+'

/** Ctrl+Tab / Ctrl+Shift+Tab step through the tabs; ⌘/Ctrl + 1…9 jumps to one. */
export function useTabShortcuts(
    enabled: boolean,
    onStep: (step: number) => void,
    onPosition: (position: number) => void
) {
    useEffect(() => {
        if (!enabled) return
        const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
            if (keyboardEvent.ctrlKey && keyboardEvent.key === 'Tab') {
                keyboardEvent.preventDefault()
                onStep(keyboardEvent.shiftKey ? -1 : 1)
                return
            }
            const withModifier = IS_MAC ? keyboardEvent.metaKey : keyboardEvent.ctrlKey
            const position = Number(keyboardEvent.key)
            if (!withModifier || !Number.isInteger(position) || position < 1) return
            keyboardEvent.preventDefault()
            onPosition(position)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [enabled, onStep, onPosition])
}
