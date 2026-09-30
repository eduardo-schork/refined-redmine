import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { CalendarEvent, CalendarPreferences, CalendarView, EditScope } from '@domain/calendar/calendar-event'
import { colorOf } from '@domain/calendar/colors'
import { atOccurrence, createEvent, duplicateOccurrence } from '@domain/calendar/event-editing'
import { expand, type Occurrence } from '@domain/calendar/recurrence'
import { addDays, monthGridStart, parseLocal, startOfDay, startOfWeek, type LocalDate } from '@domain/shared/date'
import { LAYER_HEX, useDeleteEvent, useDisplayItems, useSaveEvent, type DisplayItem } from '@/hooks/calendar'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { localId } from '@/lib/ids'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/ui/atoms/Button'
import { IconButton } from '@/ui/atoms/IconButton'
import { ColorDot, Overline } from '@/ui/atoms/misc'
import { RichText } from '@/ui/molecules/RichText'
import { SearchInput } from '@/ui/molecules/SearchInput'
import { SegmentedControl } from '@/ui/molecules/SegmentedControl'
import { useToast } from '@/ui/molecules/Toast'
import { AgendaView } from '@/ui/organisms/calendar/AgendaView'
import { EventDetails, ScopeDialog } from '@/ui/organisms/calendar/EventDetails'
import { EventEditor } from '@/ui/organisms/calendar/EventEditor'
import { MiniMonth } from '@/ui/organisms/calendar/MiniMonth'
import { MonthView } from '@/ui/organisms/calendar/MonthView'
import { TimeGrid } from '@/ui/organisms/calendar/TimeGrid'

const VIEWS: {
    key: CalendarView
    label: 'calendar.viewDay' | 'calendar.viewWeek' | 'calendar.viewMonth' | 'calendar.viewAgenda'
    shortcut: string
}[] = [
    { key: 'day', label: 'calendar.viewDay', shortcut: 'd' },
    { key: 'week', label: 'calendar.viewWeek', shortcut: 'w' },
    { key: 'month', label: 'calendar.viewMonth', shortcut: 'm' },
    { key: 'agenda', label: 'calendar.viewAgenda', shortcut: 'a' }
]

const AGENDA_PAGE_DAYS = 30
const SEARCH_FUTURE_DAYS = 730
const SEARCH_PAST_DAYS = 3650

type EditorState = {
    event: CalendarEvent
    isNew: boolean
    originalId?: string
    recurring?: boolean
    occurrenceKey?: LocalDate
}
type PendingScope =
    | { action: 'edit'; draft: CalendarEvent; originalId: string; key: LocalDate }
    | { action: 'delete'; eventId: string; key: LocalDate }
type SearchResult = { event: CalendarEvent; occurrence: Occurrence }
type WeekStart = CalendarPreferences['weekStartsOn']
type LayerKey = keyof CalendarPreferences['layers']
type Dates = ReturnType<typeof useI18n>['dates']
type StepDirection = 1 | -1

function visibleRange(view: CalendarView, date: Date, weekStartsOn: WeekStart, agendaDays: number): [Date, Date] {
    if (view === 'month') {
        const gridStart = monthGridStart(date, weekStartsOn)
        return [gridStart, addDays(gridStart, 42)]
    }
    if (view === 'week') {
        const weekStart = startOfWeek(date, weekStartsOn)
        return [weekStart, addDays(weekStart, 7)]
    }
    const dayStart = startOfDay(date)
    const length = view === 'day' ? 1 : agendaDays
    return [dayStart, addDays(dayStart, length)]
}

function steppedDate(view: CalendarView, date: Date, direction: StepDirection, agendaDays: number): Date {
    if (view === 'month') return new Date(date.getFullYear(), date.getMonth() + direction, 1)
    if (view === 'week') return addDays(date, 7 * direction)
    if (view === 'agenda') return addDays(date, direction * agendaDays)
    return addDays(date, direction)
}

function rangeTitle(from: Date, to: Date, dates: Dates): string {
    const end = addDays(to, -1)
    const sameMonth = from.getMonth() === end.getMonth()
    const startLabel = sameMonth ? String(from.getDate()) : dates.format(from, { day: 'numeric', month: 'short' })
    const endLabel = dates.format(end, { day: 'numeric', month: 'short', year: 'numeric' })
    return `${startLabel} – ${endLabel}`
}

function headerTitle(view: CalendarView, date: Date, from: Date, to: Date, dates: Dates): string {
    if (view === 'month') return dates.format(date, { month: 'long', year: 'numeric' })
    if (view === 'day') return dates.format(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return rangeTitle(from, to, dates)
}

function matchesSearch(event: CalendarEvent, query: string): boolean {
    const searchableFields = [event.title, event.description, event.location]
    return searchableFields.some((field) => field?.toLowerCase().includes(query))
}

// Prefer the next occurrence (up to two years ahead); otherwise fall back to the latest past one.
function occurrenceForSearch(event: CalendarEvent, now: Date): Occurrence | undefined {
    const upcoming = expand([event], now, addDays(now, SEARCH_FUTURE_DAYS))[0]
    if (upcoming) return upcoming
    return expand([event], addDays(now, -SEARCH_PAST_DAYS), now).pop()
}

function searchEvents(events: CalendarEvent[], search: string): SearchResult[] | null {
    const query = search.trim().toLowerCase()
    if (!query) return null
    const now = new Date()
    const results: SearchResult[] = []
    for (const event of events.filter((candidate) => matchesSearch(candidate, query))) {
        const occurrence = occurrenceForSearch(event, now)
        if (occurrence) results.push({ event, occurrence })
    }
    return results.sort((first, second) => first.occurrence.start.getTime() - second.occurrence.start.getTime())
}

function isShortcutBlocked(keyboardEvent: KeyboardEvent): boolean {
    if (keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey) return true
    const target = keyboardEvent.target as HTMLElement
    const isTyping = /INPUT|TEXTAREA|SELECT/.test(target.tagName)
    const dialogOpen = Boolean(document.querySelector('[role=dialog], .fixed.inset-0'))
    return isTyping || dialogOpen
}

export default function CalendarPage({
    focusDate,
    focusEventId,
    onGoSprints
}: {
    focusDate?: string
    focusEventId?: string
    onGoSprints: () => void
}) {
    const { t, dates, error } = useI18n()
    const toast = useToast()
    const calendarSettings = useSettings().calendar
    const updateSettings = useUpdateSettings()
    const saveEvent = useSaveEvent()
    const deleteEvent = useDeleteEvent()
    const [date, setDate] = useState(() => (focusDate ? parseLocal(focusDate) : startOfDay(new Date())))
    const [view, setViewState] = useState<CalendarView>(calendarSettings.defaultView)
    const [agendaDays, setAgendaDays] = useState(AGENDA_PAGE_DAYS)
    const [search, setSearch] = useState('')
    const [editor, setEditor] = useState<EditorState | null>(null)
    const [details, setDetails] = useState<DisplayItem | null>(null)
    const [pendingScope, setPendingScope] = useState<PendingScope | null>(null)
    const [pendingFocus, setPendingFocus] = useState(focusEventId)
    const weekStartsOn = calendarSettings.weekStartsOn
    const editingContext = () => ({ newId: localId, nowIso: new Date().toISOString() })

    function setView(nextView: CalendarView) {
        setViewState(nextView)
        if (nextView === calendarSettings.defaultView) return
        updateSettings.mutate({ calendar: { ...calendarSettings, defaultView: nextView } })
    }

    const dateMs = date.getTime()
    const [from, to] = useMemo(
        () => visibleRange(view, new Date(dateMs), weekStartsOn, agendaDays),
        [view, dateMs, weekStartsOn, agendaDays]
    )

    const { items, events } = useDisplayItems(from, to)

    // Opens a calendar event coming from a notification or from search once it is loaded.
    useEffect(() => {
        if (!pendingFocus) return
        const focused = items.find(
            (item) =>
                item.kind === 'event' &&
                item.occurrence.event.id === pendingFocus &&
                (!focusDate || item.occurrence.key === focusDate)
        )
        if (!focused) return
        setDetails(focused)
        setPendingFocus(undefined)
    }, [items, pendingFocus, focusDate])

    function step(direction: StepDirection) {
        setDate(steppedDate(view, date, direction, agendaDays))
    }

    function goToday() {
        setDate(startOfDay(new Date()))
    }

    function goDay(day: Date) {
        setDate(day)
        setView('day')
    }

    const title = useMemo(() => headerTitle(view, date, from, to, dates), [view, date, from, to, dates])

    function nextHour() {
        const hour = Math.min(22, new Date().getHours() + 1)
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour)
    }

    function openCreate(start: Date, end?: Date, allDay = false) {
        setEditor({ event: createEvent(calendarSettings, editingContext(), start, end, allDay), isNew: true })
    }

    function openEdit(item: DisplayItem) {
        if (item.kind !== 'event') return
        const original = item.occurrence.event
        setDetails(null)
        setEditor({
            event: atOccurrence(original, item.occurrence),
            isNew: false,
            originalId: original.id,
            recurring: Boolean(original.recurrence),
            occurrenceKey: item.occurrence.key
        })
    }

    function commitSave(
        draft: CalendarEvent,
        isNew: boolean,
        originalId: string | undefined,
        occurrenceKey: LocalDate | undefined,
        scope: EditScope
    ) {
        saveEvent.mutate(
            { draft, isNew, originalId, occurrenceKey, scope },
            {
                onSuccess: () => {
                    setEditor(null)
                    setPendingScope(null)
                    toast(t('calendar.saved'))
                },
                onError: (saveError) => toast(error(saveError), 'error')
            }
        )
    }

    function handleSave(draft: CalendarEvent) {
        if (!editor) return
        if (editor.isNew || !editor.originalId) {
            commitSave(draft, true, undefined, undefined, 'all')
            return
        }
        if (editor.recurring && editor.occurrenceKey) {
            setPendingScope({ action: 'edit', draft, originalId: editor.originalId, key: editor.occurrenceKey })
            return
        }
        commitSave(draft, false, editor.originalId, undefined, 'all')
    }

    function handleDelete(event: CalendarEvent, key: LocalDate) {
        setDetails(null)
        setEditor(null)
        if (event.recurrence) {
            setPendingScope({ action: 'delete', eventId: event.id, key })
            return
        }
        const confirmed = confirm(t('calendar.confirmDelete', { title: event.title || t('common.untitled') }))
        if (!confirmed) return
        deleteEvent.mutate({ eventId: event.id, scope: 'all' }, { onSuccess: () => toast(t('calendar.deleted')) })
    }

    function deleteFromDetails(item: DisplayItem) {
        if (item.kind !== 'event') return
        handleDelete(item.occurrence.event, item.occurrence.key)
    }

    function deleteFromEditor(editorState: EditorState) {
        const original = events.find((event) => event.id === editorState.originalId)!
        const key = editorState.occurrenceKey ?? editorState.event.start.slice(0, 10)
        handleDelete(original, key)
    }

    function handleScopePick(scope: EditScope) {
        if (!pendingScope) return
        if (pendingScope.action === 'edit') {
            commitSave(pendingScope.draft, false, pendingScope.originalId, pendingScope.key, scope)
            return
        }
        deleteEvent.mutate(
            { eventId: pendingScope.eventId, occurrenceKey: pendingScope.key, scope },
            {
                onSuccess: () => {
                    setPendingScope(null)
                    toast(t('calendar.deleted'))
                }
            }
        )
    }

    function duplicate(item: DisplayItem) {
        if (item.kind !== 'event') return
        setDetails(null)
        const copy = duplicateOccurrence(item.occurrence.event, item.occurrence, editingContext())
        setEditor({ event: copy, isNew: true })
    }

    function shortcutAction(key: string): (() => void) | undefined {
        const actions = new Map<string, () => void>([
            ['t', goToday],
            ['c', () => openCreate(nextHour())],
            ['n', () => step(1)],
            ['j', () => step(1)],
            ['arrowright', () => step(1)],
            ['p', () => step(-1)],
            ['k', () => step(-1)],
            ['arrowleft', () => step(-1)]
        ])
        for (const option of VIEWS) actions.set(option.shortcut, () => setView(option.key))
        return actions.get(key)
    }

    // Google Calendar-like keyboard shortcuts.
    useEffect(() => {
        const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
            if (isShortcutBlocked(keyboardEvent)) return
            const action = shortcutAction(keyboardEvent.key.toLowerCase())
            if (!action) return
            action()
            keyboardEvent.preventDefault()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    })

    const results = useMemo(() => searchEvents(events, search), [search, events])

    function setLayer(layer: LayerKey, enabled: boolean) {
        const layers = { ...calendarSettings.layers, [layer]: enabled }
        updateSettings.mutate({ calendar: { ...calendarSettings, layers } })
    }

    function openSearchResult({ event, occurrence }: SearchResult) {
        setSearch('')
        setDate(startOfDay(occurrence.start))
        setPendingFocus(event.id)
    }

    function renderMainView() {
        if (results) return <SearchResults results={results} onPick={openSearchResult} />
        if (view === 'month') {
            return (
                <MonthView
                    date={date}
                    weekStartsOn={weekStartsOn}
                    items={items}
                    onCreate={(day) => openCreate(day, undefined, true)}
                    onOpen={setDetails}
                    onDay={goDay}
                />
            )
        }
        if (view === 'agenda') {
            return (
                <AgendaView
                    from={from}
                    days={agendaDays}
                    items={items}
                    onOpen={setDetails}
                    onDay={goDay}
                    onMore={() => setAgendaDays((days) => days + AGENDA_PAGE_DAYS)}
                />
            )
        }
        const dayCount = view === 'week' ? 7 : 1
        const gridDays = Array.from({ length: dayCount }, (_, offset) => addDays(from, offset))
        return <TimeGrid days={gridDays} items={items} onCreate={openCreate} onOpen={setDetails} onDay={goDay} />
    }

    return (
        <div className="flex h-full flex-col">
            <CalendarHeader
                title={title}
                view={view}
                onViewChange={setView}
                search={search}
                onSearchChange={setSearch}
                onToday={goToday}
                onStep={step}
            />

            <div className="flex min-h-0 flex-1">
                <CalendarSidebar
                    date={date}
                    weekStartsOn={weekStartsOn}
                    events={events}
                    layers={calendarSettings.layers}
                    onPick={setDate}
                    onCreate={() => openCreate(nextHour())}
                    onLayerChange={setLayer}
                />
                <main className="min-w-0 flex-1">{renderMainView()}</main>
            </div>

            {details && (
                <EventDetails
                    item={details}
                    onClose={() => setDetails(null)}
                    onEdit={() => openEdit(details)}
                    onDuplicate={() => duplicate(details)}
                    onDelete={() => deleteFromDetails(details)}
                    onGoSprints={onGoSprints}
                />
            )}
            {editor && (
                <EventEditor
                    key={editor.event.id + editor.occurrenceKey}
                    initial={editor.event}
                    isNew={editor.isNew}
                    onCancel={() => setEditor(null)}
                    onSave={handleSave}
                    onDelete={editor.originalId ? () => deleteFromEditor(editor) : undefined}
                />
            )}
            {pendingScope && (
                <ScopeDialog
                    action={pendingScope.action}
                    onPick={handleScopePick}
                    onClose={() => setPendingScope(null)}
                />
            )}
        </div>
    )
}

function CalendarHeader({
    title,
    view,
    onViewChange,
    search,
    onSearchChange,
    onToday,
    onStep
}: {
    title: string
    view: CalendarView
    onViewChange: (view: CalendarView) => void
    search: string
    onSearchChange: (search: string) => void
    onToday: () => void
    onStep: (direction: StepDirection) => void
}) {
    const { t } = useI18n()
    const viewOptions = VIEWS.map((option) => ({
        value: option.key,
        label: t(option.label),
        title: `${t(option.label)} (${option.shortcut})`
    }))

    return (
        <header className="drag flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
            <h1 className="mr-2 text-lg font-semibold">{t('nav.calendar')}</h1>
            <div className="no-drag flex items-center gap-1">
                <Button onClick={onToday} title={t('calendar.todayShortcut')}>
                    {t('calendar.today')}
                </Button>
                <IconButton label={t('calendar.prev')} icon={<ChevronLeft size={16} />} onClick={() => onStep(-1)} />
                <IconButton label={t('calendar.next')} icon={<ChevronRight size={16} />} onClick={() => onStep(1)} />
            </div>
            <span className="text-lg first-letter:uppercase">{title}</span>
            <div className="no-drag ml-auto flex items-center gap-2">
                <SearchInput
                    className="w-52"
                    value={search}
                    onChange={onSearchChange}
                    placeholder={t('calendar.search')}
                />
                <SegmentedControl value={view} onChange={onViewChange} options={viewOptions} />
            </div>
        </header>
    )
}

function CalendarSidebar({
    date,
    weekStartsOn,
    events,
    layers,
    onPick,
    onCreate,
    onLayerChange
}: {
    date: Date
    weekStartsOn: WeekStart
    events: CalendarEvent[]
    layers: CalendarPreferences['layers']
    onPick: (day: Date) => void
    onCreate: () => void
    onLayerChange: (layer: LayerKey, enabled: boolean) => void
}) {
    const { t } = useI18n()
    return (
        <aside className="flex w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line p-3">
            <Button
                variant="primary"
                className="h-10 w-fit rounded-full px-5 shadow-sm"
                onClick={onCreate}
                title={t('calendar.createShortcut')}
            >
                <Plus size={16} /> {t('calendar.create')}
            </Button>
            <MiniMonth selected={date} weekStartsOn={weekStartsOn} events={events} onPick={onPick} />
            <div>
                <Overline className="mb-1">{t('calendar.calendars')}</Overline>
                <Layer
                    checked={layers.mine}
                    onChange={(enabled) => onLayerChange('mine', enabled)}
                    color={colorOf('peacock').hex}
                    label={t('calendar.layerMine')}
                />
                <Layer
                    checked={layers.sprints}
                    onChange={(enabled) => onLayerChange('sprints', enabled)}
                    color={LAYER_HEX.sprints}
                    label={t('calendar.layerSprints')}
                />
                <Layer
                    checked={layers.tasks}
                    onChange={(enabled) => onLayerChange('tasks', enabled)}
                    color={LAYER_HEX.tasks}
                    label={t('calendar.layerTasks')}
                />
            </div>
            <div className="mt-auto text-2xs leading-relaxed text-muted">
                <RichText k="calendar.shortcuts" />
            </div>
        </aside>
    )
}

function SearchResults({ results, onPick }: { results: SearchResult[]; onPick: (result: SearchResult) => void }) {
    const { t, dates } = useI18n()
    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-4">
                <p className="mb-2 text-xs text-muted">{t('calendar.results', { count: results.length })}</p>
                {results.map((result) => {
                    const { event, occurrence } = result
                    const dayLabel = dates.format(occurrence.start, {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    })
                    const timeLabel = dates.range(occurrence.start, occurrence.end, event.allDay, t('calendar.allDay'))
                    return (
                        <button
                            key={event.id}
                            onClick={() => onPick(result)}
                            className="flex w-full cursor-default items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-panel-2"
                        >
                            <ColorDot color={colorOf(event.color).hex} />
                            <span className="w-40 shrink-0 text-xs text-muted">{dayLabel}</span>
                            <span className="w-28 shrink-0 text-xs text-muted">{timeLabel}</span>
                            <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function Layer({
    checked,
    onChange,
    color,
    label
}: {
    checked: boolean
    onChange: (enabled: boolean) => void
    color: string
    label: string
}) {
    return (
        <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-panel-2">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-3.5 w-3.5"
                style={{ accentColor: color }}
            />
            {label}
        </label>
    )
}
