import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useIsActiveTab } from '@/lib/workspace-tabs'
import { IconButton } from '../atoms/IconButton'

export type DialogSize = 'md' | 'lg' | 'xl'
/**
 * A share of the tab's area, with a floor (small windows) and a ceiling (very wide screens, where long lines stop
 * being readable): small forms, editors, and wide dialogs with tables (trâmites, bulk edit).
 */
const SIZES: Record<DialogSize, string> = {
    md: 'w-[clamp(28rem,40%,40rem)]',
    lg: 'w-[clamp(36rem,60%,72rem)]',
    xl: 'h-[85%] w-[clamp(48rem,80%,112rem)]'
}
// A resizable dialog starts at a share of the tab, with no ceiling, and can then be dragged to any size.
const RESIZABLE_SIZES: Record<DialogSize, string> = {
    md: 'w-[40%]',
    lg: 'w-[60%]',
    xl: 'h-[85%] w-[85%]'
}

/** Share (%) of the tab's area, so the size fits a smaller or larger window the same way. */
interface StoredSize {
    width: number
    height: number
}

const sizeStorageKey = (key: string) => `refined-redmine.dialog-size.${key}`
const isShare = (value: unknown) => typeof value === 'number' && value > 0 && value <= 100

/** Size the user last dragged a dialog to; per computer, and losing it only brings back the default size. */
function loadSize(key: string): StoredSize | undefined {
    try {
        const stored = JSON.parse(localStorage.getItem(sizeStorageKey(key)) ?? 'null') as StoredSize | null
        // Sizes saved in pixels by the first version are larger than 100 and are dropped.
        return stored && isShare(stored.width) && isShare(stored.height) ? stored : undefined
    } catch {
        return undefined
    }
}

function saveSize(key: string, size: StoredSize): void {
    try {
        localStorage.setItem(sizeStorageKey(key), JSON.stringify(size))
    } catch {
        // Storage unavailable: the dialog opens at the default size next time.
    }
}

/** Inner size of the overlay (without its padding): what 100% of a dialog is. */
function areaOf(panel: HTMLElement): { width: number; height: number } | undefined {
    const area = panel.parentElement
    if (!area) return undefined
    const padding = getComputedStyle(area)
    const width = area.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight)
    const height = area.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom)
    return width > 0 && height > 0 ? { width, height } : undefined
}

const toShare = (pixels: number, total: number) => Math.min(100, Math.round((pixels / total) * 1000) / 10)

/**
 * Remembers the size the user dragged the corner to, as a share of the tab's area. Dragging makes the browser write
 * the size in pixels in the panel's inline style; the saved shares are applied back as percentages.
 */
function useRememberedSize(resizeKey: string | undefined) {
    const panelRef = useRef<HTMLDivElement>(null)
    const initial = useRef(resizeKey ? loadSize(resizeKey) : undefined)
    const saved = initial.current
    const style: CSSProperties | undefined = resizeKey
        ? {
              maxWidth: '100%',
              maxHeight: '100%',
              width: saved ? `${saved.width}%` : undefined,
              height: saved ? `${saved.height}%` : undefined
          }
        : undefined

    useEffect(() => {
        const panel = panelRef.current
        if (!resizeKey || !panel) return
        const observer = new ResizeObserver(() => {
            const draggedByUser = panel.style.width.endsWith('px') && panel.style.height.endsWith('px')
            const area = areaOf(panel)
            if (!draggedByUser || !area) return
            const width = toShare(parseFloat(panel.style.width), area.width)
            const height = toShare(parseFloat(panel.style.height), area.height)
            saveSize(resizeKey, { width, height })
        })
        observer.observe(panel)
        return () => observer.disconnect()
    }, [resizeKey])
    return { panelRef, style }
}

interface OpenDialog {
    isInFrontTab: () => boolean
}

/**
 * Open dialogs, oldest first: Esc closes only the one on top (a form opened from the issue detail). Dialogs of hidden
 * tabs stay open but are skipped: Esc is for the tab in front.
 */
const openDialogs: OpenDialog[] = []

function isOnTop(dialog: OpenDialog): boolean {
    const visibleDialogs = openDialogs.filter((candidate) => candidate.isInFrontTab())
    return visibleDialogs[visibleDialogs.length - 1] === dialog
}

/** Registered once, when the dialog opens: re-renders must not move a dialog to the top. */
function useEscapeOnTop(onClose: () => void) {
    const isActiveTab = useIsActiveTab()
    const latestOnClose = useRef(onClose)
    const latestIsActiveTab = useRef(isActiveTab)
    useEffect(() => {
        latestOnClose.current = onClose
        latestIsActiveTab.current = isActiveTab
    }, [onClose, isActiveTab])
    useEffect(() => {
        const self: OpenDialog = { isInFrontTab: () => latestIsActiveTab.current }
        openDialogs.push(self)
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOnTop(self)) latestOnClose.current()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            openDialogs.splice(openDialogs.indexOf(self), 1)
        }
    }, [])
}

/**
 * Modal window: closes on Esc or outside click. `bare` omits the default header. With `resizeKey` the user can drag
 * the corner to resize it, and the size is kept for the next time. `locked` (steps being sent) keeps it open: Esc,
 * an outside click and ✕ do nothing.
 */
export function Dialog({
    title,
    onClose,
    children,
    footer,
    size = 'md',
    bare,
    resizeKey,
    locked = false
}: {
    title?: string
    onClose: () => void
    children: ReactNode
    footer?: ReactNode
    size?: DialogSize
    bare?: boolean
    resizeKey?: string
    locked?: boolean
}) {
    const { t } = useI18n()
    const close = () => {
        if (!locked) onClose()
    }
    useEscapeOnTop(close)
    const { panelRef, style } = useRememberedSize(resizeKey)
    const sizeClasses = resizeKey
        ? cn('min-h-80 min-w-[36rem] resize', RESIZABLE_SIZES[size])
        : cn('max-w-full', SIZES[size])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onMouseDown={close}>
            <div
                ref={panelRef}
                role="dialog"
                aria-label={title}
                style={style}
                className={cn(
                    'flex max-h-full flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl',
                    sizeClasses
                )}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {!bare && (
                    <div className="flex items-center justify-between border-b border-line px-5 py-3">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <IconButton
                            label={t('common.close')}
                            icon={<X size={16} />}
                            size="sm"
                            disabled={locked}
                            onClick={close}
                        />
                    </div>
                )}
                {bare ? children : <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>}
                {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
            </div>
        </div>
    )
}
