import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { DeleteEventCommand, SaveEventCommand } from '@contracts/api'
import { colorOf } from '@domain/calendar/colors'
import { expand, type Occurrence } from '@domain/calendar/recurrence'
import type { Issue } from '@domain/redmine/entities'
import { addDays, parseLocal } from '@domain/shared/date'
import type { Sprint } from '@domain/sprint/sprint'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { useMyQueue } from './issues'
import { useSettings } from './session'
import { useSprints } from './sprints'

export const useCalendarEvents = () =>
    useQuery({ queryKey: qk.calendar, queryFn: () => api.calendar.list(), staleTime: Infinity })

export function useSaveEvent() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (cmd: SaveEventCommand) => api.calendar.save(cmd),
        onSuccess: (events) => queryClient.setQueryData(qk.calendar, events)
    })
}

export function useDeleteEvent() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (cmd: DeleteEventCommand) => api.calendar.remove(cmd),
        onSuccess: (events) => queryClient.setQueryData(qk.calendar, events)
    })
}

const SPRINT_HEX: Partial<Record<Sprint['phase'], string>> = {
    dev: '#0284C7',
    qa: '#D97706',
    late: '#DC2626',
    planned: '#64748B',
    production: '#16A34A',
    hotfix: '#7C3AED'
}
export const LAYER_HEX = { sprints: '#0284C7', tasks: '#475569' }

/** Item shown in the calendar: own calendar event or an item from a Redmine layer. */
export type DisplayItem = {
    id: string
    title: string
    start: Date
    end: Date
    allDay: boolean
    hex: string
    darkText?: boolean
    location?: string
} & ({ kind: 'event'; occurrence: Occurrence } | { kind: 'sprint'; sprint: Sprint } | { kind: 'task'; issue: Issue })

type Translate = TFunction
type CalendarEvents = NonNullable<ReturnType<typeof useCalendarEvents>['data']>
type Range = { from: Date; to: Date }

// All-day items are single-day entries, so a day overlaps the range when it starts before `to` and ends after `from`.
const isDayInRange = (day: Date, range: Range) => day < range.to && addDays(day, 1) > range.from

function toEventItems(events: CalendarEvents, range: Range, t: Translate): DisplayItem[] {
    return expand(events, range.from, range.to).map((occurrence) => {
        const { event } = occurrence
        const color = colorOf(event.color)
        return {
            kind: 'event',
            id: `${event.id}|${occurrence.key}`,
            title: event.title || t('common.untitled'),
            start: occurrence.start,
            end: occurrence.end,
            allDay: event.allDay,
            hex: color.hex,
            darkText: color.darkText,
            location: event.location,
            occurrence
        }
    })
}

function toSprintItems(sprint: Sprint, range: Range, t: Translate): DisplayItem[] {
    const isReleased = sprint.phase === 'production' || sprint.phase === 'released'
    const releaseLabel = isReleased ? t('sprint.released') : t('sprint.release')
    const milestones = [
        { date: sprint.devDeadline, label: t('sprint.devDeadline') },
        { date: sprint.release, label: releaseLabel }
    ]
    const items: DisplayItem[] = []
    for (const { date, label } of milestones) {
        if (!date) continue
        const start = parseLocal(date)
        if (!isDayInRange(start, range)) continue
        items.push({
            kind: 'sprint',
            id: `sprint|${sprint.version.id}|${label}`,
            title: `${label} · ${sprint.version.name}`,
            start,
            end: addDays(start, 1),
            allDay: true,
            hex: SPRINT_HEX[sprint.phase] ?? '#64748B',
            sprint
        })
    }
    return items
}

function toTaskItems(issues: Issue[], range: Range): DisplayItem[] {
    const items: DisplayItem[] = []
    for (const issue of issues) {
        if (!issue.due_date) continue
        const start = parseLocal(issue.due_date)
        if (!isDayInRange(start, range)) continue
        items.push({
            kind: 'task',
            id: `task|${issue.id}`,
            title: `#${issue.id} ${issue.subject}`,
            start,
            end: addDays(start, 1),
            allDay: true,
            hex: LAYER_HEX.tasks,
            issue
        })
    }
    return items
}

// All-day items first, then chronological.
function compareDisplayItems(first: DisplayItem, second: DisplayItem) {
    const allDayOrder = Number(second.allDay) - Number(first.allDay)
    if (allDayOrder !== 0) return allDayOrder
    return first.start.getTime() - second.start.getTime()
}

/** Merges calendar events (expanded) and the Redmine layers for the range [from, to). */
export function useDisplayItems(from: Date, to: Date) {
    const { t } = useTranslation()
    const { calendar } = useSettings()
    const layers = calendar.layers
    const events = useCalendarEvents()
    const sprints = useSprints()
    const issues = useMyQueue(layers.tasks)

    const items = useMemo(() => {
        const range = { from, to }
        const merged: DisplayItem[] = []
        if (layers.mine) {
            merged.push(...toEventItems(events.data ?? [], range, t))
        }
        if (layers.sprints) {
            const sprintVersions = sprints.all.filter((sprint) => sprint.kind === 'sprint')
            for (const sprint of sprintVersions) merged.push(...toSprintItems(sprint, range, t))
        }
        if (layers.tasks) {
            merged.push(...toTaskItems(issues.data?.items ?? [], range))
        }
        return merged.sort(compareDisplayItems)
    }, [events.data, sprints.all, issues.data, layers.mine, layers.sprints, layers.tasks, from, to, t])

    return { items, events: events.data ?? [], loading: events.isLoading }
}
