import { Copy } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { IconButton } from '../atoms/IconButton'
import { useToast } from './Toast'

/** Copies text to the clipboard and says what was copied. */
export function useCopy() {
    const { t } = useI18n()
    const toast = useToast()
    return async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast(t('issue.copy.copied', { text: text.length > 80 ? `${text.slice(0, 80)}…` : text }))
        } catch {
            toast(t('issue.copy.failed'), 'error')
        }
    }
}

/** Small copy icon next to a field (title, description). */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
    const copy = useCopy()
    return <IconButton size="sm" className={className} label={label} icon={<Copy />} onClick={() => void copy(text)} />
}
