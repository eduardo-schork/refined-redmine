import { addDays, sameDay } from '@domain/shared/date'
import type { DisplayItem } from '@/hooks/calendar'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '../../atoms/Button'
import { ColorDot } from '../../atoms/misc'

export function AgendaView({
    from,
    days,
    items,
    onOpen,
    onDay,
    onMore
}: {
    from: Date
    days: number
    items: DisplayItem[]
    onOpen: (item: DisplayItem) => void
    onDay: (day: Date) => void
    onMore: () => void
}) {
    const { t, dates } = useI18n()
    const today = new Date()
    const groups = Array.from({ length: days }, (_, offset) => addDays(from, offset))
        .map((day) => ({ day, list: items.filter((item) => item.start < addDays(day, 1) && item.end > day) }))
        .filter((group) => group.list.length)

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-4">
                {groups.length === 0 && (
                    <p className="py-16 text-center text-[13px] text-muted">
                        {t('calendar.nothingInRange', { count: days })}
                    </p>
                )}
                {groups.map(({ day, list }) => (
                    <div key={day.toISOString()} className="flex gap-4 border-b border-line py-2.5">
                        <button
                            onClick={() => onDay(day)}
                            className="flex w-24 shrink-0 cursor-default items-start gap-2 text-left"
                        >
                            <span
                                className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-full text-[17px]',
                                    sameDay(day, today) && 'bg-accent font-semibold text-on-accent'
                                )}
                            >
                                {day.getDate()}
                            </span>
                            <span className="mt-1.5 text-[11px] uppercase text-muted">
                                {dates.format(day, { month: 'short', weekday: 'short' })}
                            </span>
                        </button>
                        <ul className="flex min-w-0 flex-1 flex-col">
                            {list.map((item) => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => onOpen(item)}
                                        className="flex w-full cursor-default items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-panel-2"
                                    >
                                        <ColorDot color={item.hex} />
                                        <span className="w-32 shrink-0 text-xs text-muted">
                                            {dates.range(item.start, item.end, item.allDay, t('calendar.allDay'))}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                                        {item.location && (
                                            <span className="max-w-48 truncate text-xs text-muted">
                                                {item.location}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                <div className="mt-4 flex justify-center">
                    <Button onClick={onMore}>{t('calendar.showMore')}</Button>
                </div>
            </div>
        </div>
    )
}
