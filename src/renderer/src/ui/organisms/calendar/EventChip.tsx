import type { DisplayItem } from '@/hooks/calendar'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

export function EventChip({ item, onOpen }: { item: DisplayItem; onOpen: (item: DisplayItem) => void }) {
    const { dates } = useI18n()
    if (item.allDay) {
        return (
            <button
                onClick={() => onOpen(item)}
                className={cn(
                    'cursor-default truncate rounded px-1.5 py-px text-left text-2xs font-medium hover:brightness-110',
                    item.darkText ? 'text-black' : 'text-white'
                )}
                style={{ background: item.hex }}
                title={item.title}
            >
                {item.title}
            </button>
        )
    }
    return (
        <button
            onClick={() => onOpen(item)}
            className="flex cursor-default items-center gap-1 truncate rounded px-1 text-left text-2xs hover:bg-panel-2"
            title={item.title}
        >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.hex }} />
            <span className="text-muted">{dates.time(item.start)}</span>
            <span className="truncate font-medium">{item.title}</span>
        </button>
    )
}
