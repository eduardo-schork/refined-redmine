import { MAX_BOARD_ISSUES, type Board, type BoardColumn } from '@domain/board/board'
import { assertValidBoard, boardIssueFilter, targetStatus } from '@domain/board/board-rules'
import { boardMonitorId, findBoardMonitor, type Monitor } from '@domain/monitor/monitor'
import type { IssueStatus } from '@domain/redmine/entities'
import type { IssueFilter } from '@domain/redmine/issue-filter'
import { AppError } from '@domain/shared/errors'
import { pickSprint } from '@domain/sprint/sprint-classifier'
import type { Sprint } from '@domain/sprint/sprint'
import type { BoardIssues, BoardNotifications, SettingsView } from '../dto'
import type { RedmineGateway } from '../ports/redmine-gateway'
import type { SecretStore, SettingsRepository } from '../ports/repositories'
import { toView } from './session'
import type { ListSprintsUseCase } from './sprints'

function syncBoardMonitor(monitors: Monitor[], board: Board, notifications: BoardNotifications | undefined): Monitor[] {
    const existing = findBoardMonitor(monitors, board.id)
    const others = monitors.filter((monitor) => monitor !== existing)
    if (notifications === undefined) {
        if (!existing) return monitors
        return monitors.map((monitor) => (monitor === existing ? { ...existing, name: board.name } : monitor))
    }
    if (notifications === null) return others

    const monitor: Monitor = {
        ...existing,
        id: existing?.id ?? boardMonitorId(board.id),
        name: board.name,
        source: { type: 'board', boardId: board.id },
        enabled: notifications.enabled,
        events: notifications.events
    }
    return [...others, monitor]
}

export class SaveBoardUseCase {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly secrets: SecretStore,
        private readonly onMonitorsChanged: () => void
    ) {}

    execute(board: Board, notifications?: BoardNotifications): SettingsView {
        assertValidBoard(board)
        const currentSettings = this.settings.get()
        const boards = upsertBoard(currentSettings.boards, board)
        const monitors = syncBoardMonitor(currentSettings.monitors, board, notifications)
        this.settings.save({ ...currentSettings, boards, monitors })
        if (notifications !== undefined) this.onMonitorsChanged()
        return toView(this.settings, this.secrets)
    }
}

function upsertBoard(boards: Board[], board: Board): Board[] {
    const exists = boards.some((existing) => existing.id === board.id)
    if (!exists) return [...boards, board]
    return boards.map((existing) => (existing.id === board.id ? board : existing))
}

/** Deleting a board also deletes its monitor. */
export class DeleteBoardUseCase {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly secrets: SecretStore,
        private readonly onMonitorsChanged: () => void
    ) {}

    execute(boardId: string): SettingsView {
        const currentSettings = this.settings.get()
        const boards = currentSettings.boards.filter((board) => board.id !== boardId)
        const boardMonitor = findBoardMonitor(currentSettings.monitors, boardId)
        const monitors = currentSettings.monitors.filter((monitor) => monitor !== boardMonitor)
        this.settings.save({ ...currentSettings, boards, monitors })
        if (boardMonitor) this.onMonitorsChanged()
        return toView(this.settings, this.secrets)
    }
}

function findBoard(settings: SettingsRepository, boardId: string): Board {
    const board = settings.get().boards.find((candidate) => candidate.id === boardId)
    if (!board) throw new AppError('redmine.notFound')
    return board
}

function findColumn(board: Board, columnId: string): BoardColumn {
    const column = board.columns.find((candidate) => candidate.id === columnId)
    if (!column) throw new AppError('redmine.notFound')
    return column
}

export interface ResolvedBoardFilter {
    /** Undefined when an automatic sprint has no matching version today. */
    filter?: IssueFilter
    sprint?: Sprint
    sprintsConfigured: boolean
}

/** Turns a board into an issue filter, resolving the automatic sprint by the current phase. */
export class BoardFilterResolver {
    constructor(private readonly sprints: ListSprintsUseCase) {}

    async resolve(board: Board): Promise<ResolvedBoardFilter> {
        if (board.source.type !== 'sprint') return { filter: boardIssueFilter(board), sprintsConfigured: true }

        const source = board.source
        const sprintList = await this.sprints.execute()
        const sprint = resolveSprint(sprintList.all, source)
        const versionId = source.versionId ?? sprint?.version.id
        const filter = versionId ? boardIssueFilter(board, versionId) : undefined
        return { filter, sprint, sprintsConfigured: sprintList.configured }
    }
}

export class ListBoardIssuesUseCase {
    constructor(
        private readonly gateway: RedmineGateway,
        private readonly settings: SettingsRepository,
        private readonly resolver: BoardFilterResolver
    ) {}

    async execute(boardId: string): Promise<BoardIssues> {
        const board = findBoard(this.settings, boardId)
        const resolved = await this.resolver.resolve(board)
        const base = { board, sprint: resolved.sprint, sprintsConfigured: resolved.sprintsConfigured }
        if (!resolved.filter) return { ...base, unresolvedSprint: true, issues: { items: [], total: 0 } }

        const issues = await this.gateway.listIssues(resolved.filter, MAX_BOARD_ISSUES)
        return { ...base, unresolvedSprint: false, issues }
    }
}

type SprintSource = Extract<Board['source'], { type: 'sprint' }>

function resolveSprint(sprints: Sprint[], source: SprintSource): Sprint | undefined {
    if (source.versionId) return sprints.find((sprint) => sprint.version.id === source.versionId)
    if (source.auto) return pickSprint(sprints, source.auto)
    return undefined
}

/** Moves a card to a column: picks the target status that the Redmine workflow allows. */
export class MoveIssueToColumnUseCase {
    constructor(
        private readonly gateway: RedmineGateway,
        private readonly settings: SettingsRepository
    ) {}

    async execute(boardId: string, issueId: number, columnId: string): Promise<IssueStatus> {
        const board = findBoard(this.settings, boardId)
        const column = findColumn(board, columnId)
        const allowed = await this.gateway.allowedStatuses(issueId)
        const allowedIds = new Set(allowed.map((status) => status.id))
        const statusId = targetStatus(column, allowedIds)
        await this.gateway.updateIssue(issueId, { statusId })
        return allowed.find((status) => status.id === statusId)!
    }
}
