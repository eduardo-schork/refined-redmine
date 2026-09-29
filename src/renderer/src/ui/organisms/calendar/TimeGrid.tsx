import { useEffect, useRef, useState } from 'react'
import { addDays, addMinutes, sameDay, startOfDay } from '@domain/shared/date'
import type { DisplayItem } from '@/hooks/calendar'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { EventChip } from './EventChip'

const HOUR_HEIGHT = 48
const SLOT_MINUTES = 15
const MAX_ALLDAY = 3
const MS_PER_HOUR = 3_600_000
const MINUTES_PER_DAY = 24 * 60
const MIN_EVENT_HEIGHT = 18

type Placed = { item: DisplayItem; top: number; height: number; col: number; cols: number }

/** Minutes since the start of the day; `anchor` is where the drag started, `current` where the pointer is. */
type Selection = { dayIndex: number; anchor: number; current: number }

function msToPixels(ms: number): number {
    return (ms / MS_PER_HOUR) * HOUR_HEIGHT
}

function minutesToPixels(minutes: number): number {
    return (minutes / 60) * HOUR_HEIGHT
}

function overlapsDay(item: DisplayItem, day: Date): boolean {
    return item.start < addDays(day, 1) && item.end > day
}

function firstFreeColumn(columnEnds: number[], start: number): number {
    const freeColumn = columnEnds.findIndex((end) => end <= start)
    if (freeColumn !== -1) return freeColumn
    columnEnds.push(0)
    return columnEnds.length - 1
}

/**
 * Lays out overlapping events in side-by-side columns (like Google Calendar).
 * Events that transitively overlap form a cluster; each event takes the first column free at its
 * start, and every event of a cluster is drawn with the cluster's total column count.
 */
export function layoutDay(items: DisplayItem[], day: Date): Placed[] {
    const dayStart = day.getTime()
    const dayEnd = addDays(day, 1).getTime()
    const clipped = items.map((item) => ({
        item,
        start: Math.max(item.start.getTime(), dayStart),
        end: Math.min(item.end.getTime(), dayEnd)
    }))
    // Earliest first; on a tie the longer event goes first so it gets the leftmost column.
    const sorted = clipped.sort((first, second) => first.start - second.start || second.end - first.end)

    const placed: Placed[] = []
    let cluster: Placed[] = []
    let clusterEnd = 0
    const columnEnds: number[] = []

    const flushCluster = () => {
        for (const member of cluster) placed.push({ ...member, cols: columnEnds.length })
        cluster = []
        columnEnds.length = 0
    }

    for (const segment of sorted) {
        const startsNewCluster = cluster.length > 0 && segment.start >= clusterEnd
        if (startsNewCluster) flushCluster()
        const column = firstFreeColumn(columnEnds, segment.start)
        columnEnds[column] = segment.end
        clusterEnd = Math.max(clusterEnd, segment.end)
        cluster.push({
            item: segment.item,
            top: msToPixels(segment.start - dayStart),
            height: Math.max(MIN_EVENT_HEIGHT, msToPixels(segment.end - segment.start) - 2),
            col: column,
            cols: 1
        })
    }
    flushCluster()
    return placed
}

function slotAt(pointer: { clientY: number }, column: HTMLElement): number {
    const rect = column.getBoundingClientRect()
    const minutes = ((pointer.clientY - rect.top) / HOUR_HEIGHT) * 60
    const snapped = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES
    return Math.max(0, Math.min(MINUTES_PER_DAY - SLOT_MINUTES, snapped))
}

function selectionBounds(selection: Selection): { startMinutes: number; endMinutes: number } {
    const startMinutes = Math.min(selection.anchor, selection.current)
    const endMinutes = Math.max(selection.anchor, selection.current) + SLOT_MINUTES
    return { startMinutes, endMinutes }
}

export function TimeGrid({
    days,
    items,
    onCreate,
    onOpen,
    onDay
}: {
    days: Date[]
    items: DisplayItem[]
    onCreate: (start: Date, end: Date | undefined, allDay: boolean) => void
    onOpen: (item: DisplayItem) => void
    onDay: (day: Date) => void
}) {
    const { t } = useI18n()
    const scroller = useRef<HTMLDivElement>(null)
    const [now, setNow] = useState(new Date())
    const [selection, setSelection] = useState<Selection | null>(null)
    const selectionRef = useRef(selection)
    selectionRef.current = selection

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000)
        return () => clearInterval(timer)
    }, [])

    // Scrolls near the current hour when today is visible, otherwise to 7 AM.
    useEffect(() => {
        const showsToday = days.some((day) => sameDay(day, new Date()))
        const targetHour = showsToday ? Math.max(0, new Date().getHours() - 1) : 7
        scroller.current?.scrollTo({ top: targetHour * HOUR_HEIGHT })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days.length])

    function finishSelection(finished: Selection) {
        const day = days[finished.dayIndex]
        const isClick = finished.anchor === finished.current
        if (isClick) {
            const halfHour = Math.floor(finished.anchor / 30) * 30
            onCreate(addMinutes(day, halfHour), undefined, false)
            return
        }
        const { startMinutes, endMinutes } = selectionBounds(finished)
        onCreate(addMinutes(day, startMinutes), addMinutes(day, endMinutes), false)
    }

    function handlePointerDown(pointerEvent: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
        const clickedEmptyArea = pointerEvent.target === pointerEvent.currentTarget
        if (pointerEvent.button !== 0 || !clickedEmptyArea) return
        const column = pointerEvent.currentTarget
        const anchor = slotAt(pointerEvent, column)
        setSelection({ dayIndex, anchor, current: anchor })

        const handleMove = (moveEvent: PointerEvent) => {
            setSelection((previous) => previous && { ...previous, current: slotAt(moveEvent, column) })
        }
        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
            const finished = selectionRef.current
            setSelection(null)
            if (finished) finishSelection(finished)
        }
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }

    const allDayItems = items.filter((item) => item.allDay)
    const timedItems = items.filter((item) => !item.allDay)
    const gridColumns = `56px repeat(${days.length}, minmax(0, 1fr))`
    const nowTop = msToPixels(now.getTime() - startOfDay(now).getTime())

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-line pr-[10px]">
                <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
                    <div />
                    {days.map((day) => (
                        <DayHeader key={day.toISOString()} day={day} isToday={sameDay(day, now)} onDay={onDay} />
                    ))}
                </div>
                <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
                    <div className="py-1 pr-2 text-right text-[10px] text-muted">{t('calendar.allDayShort')}</div>
                    {days.map((day) => (
                        <AllDayCell
                            key={day.toISOString()}
                            day={day}
                            items={allDayItems.filter((item) => overlapsDay(item, day))}
                            onCreate={onCreate}
                            onOpen={onOpen}
                            onDay={onDay}
                        />
                    ))}
                </div>
            </div>

            <div ref={scroller} className="flex-1 overflow-y-scroll">
                <div className="relative grid" style={{ gridTemplateColumns: gridColumns, height: 24 * HOUR_HEIGHT }}>
                    <HourLabels />
                    {days.map((day, dayIndex) => (
                        <DayColumn
                            key={day.toISOString()}
                            day={day}
                            items={timedItems.filter((item) => overlapsDay(item, day))}
                            selection={selection?.dayIndex === dayIndex ? selection : null}
                            nowTop={sameDay(day, now) ? nowTop : undefined}
                            onPointerDown={(pointerEvent) => handlePointerDown(pointerEvent, dayIndex)}
                            onOpen={onOpen}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function DayHeader({ day, isToday, onDay }: { day: Date; isToday: boolean; onDay: (day: Date) => void }) {
    const { dates } = useI18n()
    return (
        <button onClick={() => onDay(day)} className="flex cursor-default flex-col items-center py-1.5">
            <span className={cn('text-[11px] font-medium uppercase', isToday ? 'text-accent' : 'text-muted')}>
                {dates.weekdayShort(day.getDay())}
            </span>
            <span
                className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-[20px]',
                    isToday ? 'bg-accent font-semibold text-on-accent' : 'hover:bg-panel-2'
                )}
            >
                {day.getDate()}
            </span>
        </button>
    )
}

function AllDayCell({
    day,
    items,
    onCreate,
    onOpen,
    onDay
}: {
    day: Date
    items: DisplayItem[]
    onCreate: (start: Date, end: Date | undefined, allDay: boolean) => void
    onOpen: (item: DisplayItem) => void
    onDay: (day: Date) => void
}) {
    const { t } = useI18n()
    const hiddenCount = items.length - MAX_ALLDAY

    function handleClick(clickEvent: React.MouseEvent<HTMLDivElement>) {
        if (clickEvent.target !== clickEvent.currentTarget) return
        onCreate(day, undefined, true)
    }

    return (
        <div className="flex min-h-7 flex-col gap-0.5 border-l border-line p-0.5" onClick={handleClick}>
            {items.slice(0, MAX_ALLDAY).map((item) => (
                <EventChip key={item.id} item={item} onOpen={onOpen} />
            ))}
            {hiddenCount > 0 && (
                <button onClick={() => onDay(day)} className="px-1 text-left text-[11px] text-muted hover:text-fg">
                    {t('calendar.more', { count: hiddenCount })}
                </button>
            )}
        </div>
    )
}

function HourLabels() {
    const { dates } = useI18n()
    return (
        <div className="relative">
            {Array.from({ length: 23 }, (_, index) => {
                const hour = index + 1
                return (
                    <span
                        key={index}
                        className="absolute right-2 -translate-y-1/2 text-[10px] text-muted"
                        style={{ top: hour * HOUR_HEIGHT }}
                    >
                        {dates.time(new Date(2000, 0, 1, hour))}
                    </span>
                )
            })}
        </div>
    )
}

function DayColumn({
    day,
    items,
    selection,
    nowTop,
    onPointerDown,
    onOpen
}: {
    day: Date
    items: DisplayItem[]
    selection: Selection | null
    nowTop?: number
    onPointerDown: (pointerEvent: React.PointerEvent<HTMLDivElement>) => void
    onOpen: (item: DisplayItem) => void
}) {
    return (
        <div
            className="relative border-l border-line"
            style={{
                backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`
            }}
            onPointerDown={onPointerDown}
        >
            {selection && <SelectionOverlay day={day} selection={selection} />}
            {layoutDay(items, day).map((placed) => (
                <TimedEvent key={placed.item.id} placed={placed} onOpen={onOpen} />
            ))}
            {nowTop !== undefined && (
                <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                    <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-0.5 bg-red-500" />
                </div>
            )}
        </div>
    )
}

function SelectionOverlay({ day, selection }: { day: Date; selection: Selection }) {
    const { dates } = useI18n()
    const { startMinutes, endMinutes } = selectionBounds(selection)
    return (
        <div
            className="pointer-events-none absolute inset-x-1 z-10 rounded-md bg-accent/80 px-1.5 py-0.5 text-[11px] text-on-accent"
            style={{
                top: minutesToPixels(startMinutes),
                height: minutesToPixels(endMinutes - startMinutes)
            }}
        >
            {dates.time(addMinutes(day, startMinutes))} – {dates.time(addMinutes(day, endMinutes))}
        </div>
    )
}

function TimedEvent({ placed, onOpen }: { placed: Placed; onOpen: (item: DisplayItem) => void }) {
    const { dates } = useI18n()
    const { item, top, height, col, cols } = placed
    const showTime = height > 30
    const showLocation = Boolean(item.location) && height > 44
    return (
        <button
            onClick={() => onOpen(item)}
            className={cn(
                'absolute cursor-default overflow-hidden rounded-md border border-[var(--panel)] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm hover:brightness-110',
                item.darkText ? 'text-black' : 'text-white'
            )}
            style={{
                top,
                height,
                left: `calc(${(col / cols) * 100}% + 2px)`,
                width: `calc(${100 / cols}% - 4px)`,
                background: item.hex
            }}
            title={`${item.title} · ${dates.time(item.start)}–${dates.time(item.end)}`}
        >
            <div className="truncate font-semibold">{item.title}</div>
            {showTime && (
                <div className="truncate opacity-90">
                    {dates.time(item.start)} – {dates.time(item.end)}
                    {showLocation ? `, ${item.location}` : ''}
                </div>
            )}
        </button>
    )
}
