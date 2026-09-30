import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '@domain/calendar/calendar-event'
import { expand } from '@domain/calendar/recurrence'
import { addDays, monthGridStart, sameDay, toLocalDate } from '@domain/shared/date'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

function dayClass(day: Date, today: Date, selected: Date, month: Date): string {
    if (sameDay(day, today)) return 'bg-accent font-semibold text-on-accent'
    if (sameDay(day, selected)) return 'bg-accent-soft font-semibold text-accent'
    if (day.getMonth() === month.getMonth()) return 'hover:bg-panel-2'
    return 'text-muted/60 hover:bg-panel-2'
}

function shiftMonth(month: Date, offset: number): Date {
    return new Date(month.getFullYear(), month.getMonth() + offset, 1)
}

export function MiniMonth({
    selected,
    weekStartsOn,
    events,
    onPick
}: {
    selected: Date
    weekStartsOn: 0 | 1
    events: CalendarEvent[]
    onPick: (day: Date) => void
}) {
    const { dates } = useI18n()
    const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
    const selectedYear = selected.getFullYear()
    const selectedMonth = selected.getMonth()
    useEffect(() => setMonth(new Date(selectedYear, selectedMonth, 1)), [selectedYear, selectedMonth])
    const start = monthGridStart(month, weekStartsOn)
    const days = Array.from({ length: 42 }, (_, offset) => addDays(start, offset))
    const startMs = start.getTime()
    const busy = useMemo(() => {
        const gridStart = new Date(startMs)
        const occurrences = expand(events, gridStart, addDays(gridStart, 42))
        return new Set(occurrences.map((occurrence) => occurrence.key))
    }, [events, startMs])
    const today = new Date()

    return (
        <div className="text-2xs">
            <div className="mb-1 flex items-center justify-between">
                <span className="pl-1 text-xs font-medium first-letter:uppercase">
                    {dates.format(month, { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex">
                    <button
                        className="rounded p-0.5 text-muted hover:bg-panel-2"
                        onClick={() => setMonth(shiftMonth(month, -1))}
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        className="rounded p-0.5 text-muted hover:bg-panel-2"
                        onClick={() => setMonth(shiftMonth(month, 1))}
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 text-center">
                {days.slice(0, 7).map((day) => (
                    <span key={day.getDay()} className="py-0.5 text-muted">
                        {dates.weekdayShort(day.getDay())[0].toUpperCase()}
                    </span>
                ))}
                {days.map((day) => {
                    const key = toLocalDate(day)
                    const showBusyDot = busy.has(key) && !sameDay(day, today)
                    return (
                        <button
                            key={key}
                            onClick={() => onPick(day)}
                            className={cn(
                                'relative mx-auto flex h-6 w-6 cursor-default items-center justify-center rounded-full',
                                dayClass(day, today, selected, month)
                            )}
                        >
                            {day.getDate()}
                            {showBusyDot && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
