import { useRef } from 'react'

/**
 * The name of a board or monitor follows its source (the saved query's name, the board's…) while the user has not
 * typed one of their own: it is empty or still the last suggestion. Returns the name to keep.
 */
export function useNameFollowingSource() {
    const lastSuggestion = useRef('')
    return (currentName: string, suggestedName?: string): string => {
        const followsSource = !currentName.trim() || currentName === lastSuggestion.current
        if (!suggestedName || !followsSource) return currentName
        lastSuggestion.current = suggestedName
        return suggestedName
    }
}
