import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useIsActiveTab } from './workspace-tabs'

/**
 * A dropdown that floats over everything: it opens in the top layer (`popover`), so the `overflow` of a dialog body
 * or the layout containment of a tab can't clip it or make it scroll, and CSS anchor positioning keeps it under its
 * button (or above it when there is no room below), lined up with the button's left edge (`start`) or right edge
 * (`end`). It closes on a click or focus outside `rootRef`, when the window loses focus and when its tab is hidden.
 */
export function useFloating(open: boolean, close: () => void, align: 'start' | 'end' = 'start') {
    const rootRef = useRef<HTMLDivElement>(null)
    const floatingRef = useRef<HTMLDivElement>(null)
    const anchorName = `--floating-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
    const isActiveTab = useIsActiveTab()
    const latestClose = useRef(close)

    useEffect(() => {
        latestClose.current = close
    }, [close])

    useLayoutEffect(() => {
        if (open) floatingRef.current?.showPopover()
    }, [open])

    useEffect(() => {
        if (open && !isActiveTab) latestClose.current()
    }, [open, isActiveTab])

    useEffect(() => {
        const root = rootRef.current
        if (!open || !root) return
        const isOutside = (target: EventTarget | null) => target instanceof Node && !root.contains(target)
        // Capture phase: dialogs stop `mousedown` from bubbling, so a bubbling listener missed clicks inside them.
        const closeOnPointer = (pointerEvent: PointerEvent) => {
            if (isOutside(pointerEvent.target)) latestClose.current()
        }
        // Focus moving to another field (Tab, a click in an input) also closes it; focus lost to nothing does not.
        const closeOnFocus = (focusEvent: FocusEvent) => {
            if (isOutside(focusEvent.relatedTarget)) latestClose.current()
        }
        const closeOnBlur = () => latestClose.current()
        document.addEventListener('pointerdown', closeOnPointer, true)
        root.addEventListener('focusout', closeOnFocus)
        window.addEventListener('blur', closeOnBlur)
        return () => {
            document.removeEventListener('pointerdown', closeOnPointer, true)
            root.removeEventListener('focusout', closeOnFocus)
            window.removeEventListener('blur', closeOnBlur)
        }
    }, [open])

    const anchorStyle: CSSProperties = { anchorName }
    const floatingStyle: CSSProperties = {
        positionAnchor: anchorName,
        inset: 'auto',
        top: 'anchor(bottom)',
        ...(align === 'start' ? { left: 'anchor(left)' } : { right: 'anchor(right)' }),
        minWidth: 'anchor-size(width)',
        positionTryFallbacks: 'flip-block, flip-inline, flip-block flip-inline'
    }
    return { rootRef, floatingRef, anchorStyle, floatingStyle }
}

/** Base classes of a floating panel: undo the browser's popover defaults (centered, padded, with a border). */
export const FLOATING_PANEL = 'm-0 my-1 overflow-hidden rounded-lg border border-line bg-panel p-0 text-fg shadow-2xl'
