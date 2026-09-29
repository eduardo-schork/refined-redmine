import { AppError } from '../shared/errors'
import type { Schedule } from './schedule'

/**
 * What a monitor can report.
 * - Journal events (new_issue … updated) come from the issues' history.
 * - `entered`/`left`: an issue started or stopped matching the source. For "my issues", `left` is the queue exit.
 */
export type MonitorEvent = 'new_issue' | 'assigned' | 'status' | 'comment' | 'mention' | 'updated' | 'entered' | 'left'

export interface MineScopes {
    assigned: boolean
    watched: boolean
    authored: boolean
}

export type MonitorSource =
    | { type: 'mine'; scopes: MineScopes }
    | { type: 'query'; queryId: number; projectId?: number }
    | { type: 'filter'; url: string }
    | { type: 'board'; boardId: string }

export type MonitorSourceType = MonitorSource['type']

/** A set of issues watched by the monitor, with its own notification options. */
export interface Monitor {
    id: string
    name: string
    enabled: boolean
    source: MonitorSource
    events: Record<MonitorEvent, boolean>
    /** Own time window, applied on top of the global one. */
    schedule?: Schedule
}

/** The built-in "my issues" monitor: always exists and cannot be deleted. */
export const MINE_MONITOR_ID = 'mine'

export const JOURNAL_EVENTS: MonitorEvent[] = ['new_issue', 'assigned', 'status', 'comment', 'mention', 'updated']

// "Entered" covers issues created inside a query/filter/board, and "assigned" already covers entering "my issues".
const EVENTS_BY_SOURCE: Record<MonitorSourceType, MonitorEvent[]> = {
    mine: ['new_issue', 'assigned', 'status', 'comment', 'mention', 'updated', 'left'],
    query: ['entered', 'left', 'assigned', 'status', 'comment', 'mention', 'updated'],
    filter: ['entered', 'left', 'assigned', 'status', 'comment', 'mention', 'updated'],
    board: ['entered', 'left', 'assigned', 'status', 'comment', 'mention', 'updated']
}

const ALL_OFF: Record<MonitorEvent, boolean> = {
    new_issue: false,
    assigned: false,
    status: false,
    comment: false,
    mention: false,
    updated: false,
    entered: false,
    left: false
}

// "Other changes" is off by default everywhere: it is too noisy.
const DEFAULT_ON: Record<MonitorSourceType, MonitorEvent[]> = {
    mine: ['new_issue', 'assigned', 'status', 'comment', 'mention', 'left'],
    query: ['entered', 'status', 'comment', 'mention'],
    filter: ['entered', 'status', 'comment', 'mention'],
    board: ['entered', 'left', 'status', 'comment', 'mention']
}

export function availableEvents(sourceType: MonitorSourceType): MonitorEvent[] {
    return EVENTS_BY_SOURCE[sourceType]
}

export function defaultEvents(sourceType: MonitorSourceType): Record<MonitorEvent, boolean> {
    const events = { ...ALL_OFF }
    for (const event of DEFAULT_ON[sourceType]) events[event] = true
    return events
}

/** Is the event offered for this source and switched on? */
export function isEventEnabled(monitor: Monitor, event: MonitorEvent): boolean {
    const offered = EVENTS_BY_SOURCE[monitor.source.type].includes(event)
    return offered && monitor.events[event]
}

export function createMineMonitor(scopes: MineScopes, events = defaultEvents('mine')): Monitor {
    return { id: MINE_MONITOR_ID, name: '', enabled: true, source: { type: 'mine', scopes }, events }
}

function assertValidSource(source: MonitorSource): void {
    if (source.type === 'query' && !source.queryId) throw new AppError('monitor.sourceRequired')
    if (source.type === 'filter' && !source.url.trim()) throw new AppError('monitor.sourceRequired')
    if (source.type === 'board' && !source.boardId) throw new AppError('monitor.sourceRequired')
}

/** The "my issues" monitor has a translated name, so an empty name is allowed only for it. */
export function assertValidMonitor(monitor: Monitor): void {
    const isMine = monitor.id === MINE_MONITOR_ID
    if (!isMine && !monitor.name.trim()) throw new AppError('monitor.nameRequired')
    assertValidSource(monitor.source)
}

/** Keeps "my issues" first and guarantees it exists. */
export function withMineMonitor(monitors: Monitor[], fallbackScopes: MineScopes): Monitor[] {
    const mine = monitors.find((monitor) => monitor.id === MINE_MONITOR_ID) ?? createMineMonitor(fallbackScopes)
    const others = monitors.filter((monitor) => monitor.id !== MINE_MONITOR_ID)
    return [mine, ...others]
}

export const boardMonitorId = (boardId: string) => `board:${boardId}`

export function findBoardMonitor(monitors: Monitor[], boardId: string): Monitor | undefined {
    return monitors.find((monitor) => monitor.source.type === 'board' && monitor.source.boardId === boardId)
}
