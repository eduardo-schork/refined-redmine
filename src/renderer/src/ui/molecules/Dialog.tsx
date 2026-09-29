import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { IconButton } from '../atoms/IconButton'

export type DialogSize = 'md' | 'lg' | 'xl'
const SIZES: Record<DialogSize, string> = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'h-full max-h-[900px] max-w-5xl' }

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
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

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
                        <h2 className="text-[15px] font-semibold">{title}</h2>
                        <IconButton
                            label={t('common.close')}
                            icon={<X size={16} />}
                            className="h-7 w-7"
                            onClick={onClose}
                        />
                    </div>
                )}
                {bare ? children : <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>}
                {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
            </div>
        </div>
    )
}
