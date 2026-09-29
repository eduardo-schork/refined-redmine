import { RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { IconButton } from '../atoms/IconButton'

export function RefreshButton({ spinning, onClick }: { spinning: boolean; onClick: () => void }) {
    const { t } = useI18n()
    return (
        <IconButton
            label={t('common.refresh')}
            icon={<RefreshCw size={14} className={cn(spinning && 'animate-spin')} />}
            onClick={onClick}
        />
    )
}
