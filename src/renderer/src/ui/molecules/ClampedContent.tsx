import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

// Content only a few lines taller than the limit is shown whole: hiding two lines behind a button helps nobody.
const SLACK_LINES = 3

/** Height that shows `lines` lines of the content, or null when the content is not much taller than that. */
function clampedHeight(content: HTMLElement, lines: number, slackLines: number): number | null {
    const styled = content.firstElementChild ?? content
    const lineHeight = parseFloat(getComputedStyle(styled).lineHeight)
    if (!lineHeight) return null
    const tooTall = content.offsetHeight > lineHeight * (lines + slackLines)
    return tooTall ? lineHeight * lines : null
}

/**
 * Shows the first `lines` lines of long content, fading out, with a button to show the rest. The fade is a gradient
 * laid over the text, not a CSS mask: a mask would also cut windows opened from inside the text (an image preview).
 * Content up to `slackLines` lines taller than the limit is shown whole.
 */
export function ClampedContent({
    lines,
    slackLines = SLACK_LINES,
    children
}: {
    lines: number
    slackLines?: number
    children: ReactNode
}) {
    const { t } = useI18n()
    const contentRef = useRef<HTMLDivElement>(null)
    const [limit, setLimit] = useState<number | null>(null)
    const [expanded, setExpanded] = useState(false)

    // Measured again when the content or the window width changes the content's height.
    useLayoutEffect(() => {
        const content = contentRef.current
        if (!content) return
        const measure = () => setLimit(clampedHeight(content, lines, slackLines))
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(content)
        return () => observer.disconnect()
    }, [lines, slackLines])

    const clamped = limit !== null && !expanded
    const clampStyle = clamped ? { maxHeight: limit, overflow: 'hidden' } : undefined
    const Chevron = expanded ? ChevronUp : ChevronDown

    return (
        <div>
            <div className="relative" style={clampStyle}>
                <div ref={contentRef}>{children}</div>
                {clamped && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-panel" />
                )}
            </div>
            {limit !== null && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1 flex cursor-default items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                    <Chevron size={14} />
                    {expanded ? t('common.showLess') : t('common.showAll')}
                </button>
            )}
        </div>
    )
}
