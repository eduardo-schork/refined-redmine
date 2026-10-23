import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useIsActiveTab } from '@/lib/workspace-tabs'
import { IconButton } from '../atoms/IconButton'

export type DialogSize = 'md' | 'lg' | 'xl'
const SIZES: Record<DialogSize, string> = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'h-full max-h-[900px] max-w-5xl' }

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

/** Modal window: closes on Esc or outside click. `bare` omits the default header. */
export function Dialog({
    title,
    onClose,
    children,
    footer,
    size = 'md',
    bare
}: {
    title?: string
    onClose: () => void
    children: ReactNode
    footer?: ReactNode
    size?: DialogSize
    bare?: boolean
}) {
    const { t } = useI18n()
    useEscapeOnTop(onClose)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onMouseDown={onClose}>
            <div
                role="dialog"
                aria-label={title}
                className={cn(
                    'flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl',
                    SIZES[size]
                )}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {!bare && (
                    <div className="flex items-center justify-between border-b border-line px-5 py-3">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <IconButton label={t('common.close')} icon={<X size={16} />} size="sm" onClick={onClose} />
                    </div>
                )}
                {bare ? children : <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>}
                {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
            </div>
        </div>
    )
}
