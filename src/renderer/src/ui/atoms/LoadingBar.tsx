import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

/** Thin line with a segment sliding back and forth while data loads; nothing when idle. */
export function LoadingBar({ active, className }: { active: boolean; className?: string }) {
    const { t } = useI18n()
    if (!active) return null
    return (
        <div
            role="progressbar"
            aria-label={t('common.loading')}
            className={cn('loading-bar pointer-events-none relative h-0.5 overflow-hidden bg-accent/20', className)}
        />
    )
}
