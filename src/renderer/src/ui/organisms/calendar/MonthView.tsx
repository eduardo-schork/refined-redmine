import { addDays, monthGridStart, sameDay } from '@domain/shared/date'
import type { DisplayItem } from '@/hooks/calendar'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { EventChip } from './EventChip'

const MAX_PER_DAY = 3

function dayNumberClass(isToday: boolean, inMonth: boolean): string {
    if (isToday) return 'bg-accent font-semibold text-on-accent'
    if (inMonth) return 'hover:bg-panel-2'
    return 'text-muted hover:bg-panel-2'
}

export function MonthView({
    date,
    weekStartsOn,
    items,
    onCreate,
    onOpen,
    onDay
}: {
    date: Date
    weekStartsOn: 0 | 1
    items: DisplayItem[]
    onCreate: (day: Date) => void
    onOpen: (item: DisplayItem) => void
    onDay: (day: Date) => void
}) {
    const { t, dates } = useI18n()
    const start = monthGridStart(date, weekStartsOn)
    const days = Array.from({ length: 42 }, (_, offset) => addDays(start, offset))
    const today = new Date()

    return (
        <div className="flex h-full flex-col">
            <div className="grid grid-cols-7 border-b border-line">
                {days.slice(0, 7).map((day) => (
                    <div key={day.getDay()} className="py-1.5 text-center text-[11px] font-medium uppercase text-muted">
                        {dates.weekdayShort(day.getDay())}
                    </div>
                ))}
            </div>
            <div className="grid flex-1 grid-cols-7 grid-rows-6">
                {days.map((day) => {
                    const nextDay = addDays(day, 1)
                    const dayItems = items.filter((item) => item.start < nextDay && item.end > day)
                    const inMonth = day.getMonth() === date.getMonth()
                    const isToday = sameDay(day, today)
                    const isFirstOfMonth = day.getDate() === 1
                    const dayLabel = isFirstOfMonth
                        ? dates.format(day, { day: 'numeric', month: 'short' })
                        : day.getDate()
                    const hiddenCount = dayItems.length - MAX_PER_DAY
                    const handleCellClick = (clickEvent: React.MouseEvent<HTMLDivElement>) => {
                        if (clickEvent.target !== clickEvent.currentTarget) return
                        onCreate(day)
                    }
                    return (
                        <div
                            key={day.toISOString()}
                            className={cn(
                                'flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-line p-1',
                                !inMonth && 'bg-panel-2/40'
                            )}
                            onClick={handleCellClick}
                        >
                            <button
                                onClick={() => onDay(day)}
                                className={cn(
                                    'mx-auto mb-0.5 flex h-6 min-w-6 cursor-default items-center justify-center rounded-full px-1 text-[12px]',
                                    dayNumberClass(isToday, inMonth)
                                )}
                            >
                                {dayLabel}
                            </button>
                            {dayItems.slice(0, MAX_PER_DAY).map((item) => (
                                <EventChip key={item.id} item={item} onOpen={onOpen} />
                            ))}
                            {hiddenCount > 0 && (
                                <button
                                    onClick={() => onDay(day)}
                                    className="cursor-default rounded px-1.5 text-left text-[11px] font-medium text-muted hover:bg-panel-2"
                                >
                                    {t('calendar.more', { count: hiddenCount })}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
