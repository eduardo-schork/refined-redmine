import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import type { BoardNotifications } from '@contracts/api'
import type { Board, BoardColumn, BoardSource } from '@domain/board/board'
import { columnsFromStatuses, suggestedStatuses } from '@domain/board/board-rules'
import { defaultEvents, findBoardMonitor, type Monitor } from '@domain/monitor/monitor'
import type { IssueStatus } from '@domain/redmine/entities'
import { compareVersions } from '@domain/sprint/sprint-classifier'
import type { SprintAutoPick } from '@domain/sprint/sprint'
import { useColumnSuggestion, useSaveBoard } from '@/hooks/boards'
import { useProjects, useStatuses } from '@/hooks/reference'
import { useSettings } from '@/hooks/session'
import { useSprints } from '@/hooks/sprints'
import { localId } from '@/lib/ids'
import { moveItem } from '@/lib/move-item'
import { useI18n } from '@/lib/i18n'
import { useNameFollowingSource } from '@/lib/name-following-source'
import { Button } from '../atoms/Button'
import { AddSelect, Input, Select } from '../atoms/fields'
import { IconButton } from '../atoms/IconButton'
import { Dialog } from '../molecules/Dialog'
import { Field, ToggleField } from '../molecules/Field'
import { PickList, type PickOption } from '../molecules/PickList'
import { useToast } from '../molecules/Toast'
import { FilterUrlField } from './FilterUrlField'
import { MonitorEventsFields } from './monitors/MonitorEventsFields'
import { SavedQuerySelect } from './SavedQuerySelect'

type ProjectSource = Extract<BoardSource, { type: 'project' }>
type QuerySource = Extract<BoardSource, { type: 'query' }>
type FilterSource = Extract<BoardSource, { type: 'filter' }>
type SprintSource = Extract<BoardSource, { type: 'sprint' }>
type ProjectsQuery = ReturnType<typeof useProjects>
type SprintsQuery = ReturnType<typeof useSprints>
type StatusesQuery = ReturnType<typeof useStatuses>
/** `suggestedName`: what the board could be called with this source (the saved query's name, the project's…). */
type SourceChange = (source: BoardSource, suggestedName?: string) => void
type ColumnsUpdater = (update: (columns: BoardColumn[]) => BoardColumn[]) => void

const EMPTY: Board = { id: '', name: '', source: { type: 'mine' }, columns: [], swimlanes: 'none' }
const AUTO_PICKS: SprintAutoPick[] = ['dev', 'qa', 'hotfix']
const AUTO_PREFIX = 'auto:'

const DEFAULT_SOURCES: Record<BoardSource['type'], () => BoardSource> = {
    mine: () => ({ type: 'mine' }),
    project: () => ({ type: 'project', projectId: 0, includeSubprojects: true }),
    query: () => ({ type: 'query', queryId: 0 }),
    filter: () => ({ type: 'filter', url: '' }),
    sprint: () => ({ type: 'sprint', auto: 'dev' })
}

export function BoardEditor({
    board,
    initial,
    onClose,
    onSaved
}: {
    board?: Board
    initial?: Partial<Board>
    onClose: () => void
    onSaved: (id: string) => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const statuses = useStatuses()
    const projects = useProjects()
    const sprints = useSprints()
    const save = useSaveBoard()
    const settings = useSettings()
    const [draft, setDraft] = useState<Board>(() => structuredClone(board ?? { ...EMPTY, ...initial, id: localId() }))
    const existingMonitor = board ? findBoardMonitor(settings.monitors, board.id) : undefined
    const [notifications, setNotifications] = useState(() => initialNotifications(existingMonitor))

    const source = draft.source
    const nameFor = useNameFollowingSource()
    const setSource: SourceChange = (nextSource, suggestedName) =>
        setDraft((previous) => ({ ...previous, source: nextSource, name: nameFor(previous.name, suggestedName) }))
    const changeSourceType = (type: BoardSource['type']) => {
        const suggestion = type === 'mine' ? t('board.editor.sourceMine') : undefined
        setSource(DEFAULT_SOURCES[type](), suggestion)
    }
    const updateColumns: ColumnsUpdater = (update) =>
        setDraft((previous) => ({ ...previous, columns: update(previous.columns) }))
    const suggestion = useSuggestedColumns(draft, statuses, updateColumns)

    function submit() {
        const boardNotifications = notificationsToSave(notifications, existingMonitor)
        save.mutate(
            { board: draft, notifications: boardNotifications },
            {
                onSuccess: () => onSaved(draft.id),
                onError: (saveError) => toast(error(saveError), 'error')
            }
        )
    }

    const footer = (
        <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={submit} disabled={save.isPending}>
                {t('common.save')}
            </Button>
        </>
    )

    return (
        <Dialog
            size="lg"
            title={board ? t('board.editor.editTitle') : t('board.editor.newTitle')}
            onClose={onClose}
            footer={footer}
        >
            <div className="flex flex-col gap-5">
                <Field label={t('board.editor.source')}>
                    <Select
                        autoFocus={!board}
                        value={source.type}
                        onChange={(event) => changeSourceType(event.target.value as BoardSource['type'])}
                    >
                        <option value="sprint">{t('board.editor.sourceSprint')}</option>
                        <option value="mine">{t('board.editor.sourceMine')}</option>
                        <option value="project">{t('board.editor.sourceProject')}</option>
                        <option value="query">{t('board.editor.sourceQuery')}</option>
                        <option value="filter">{t('board.editor.sourceFilter')}</option>
                    </Select>
                </Field>

                {source.type === 'project' && (
                    <ProjectSourceFields source={source} projects={projects} onChange={setSource} />
                )}
                {source.type === 'query' && <QuerySourceFields source={source} onChange={setSource} />}
                {source.type === 'filter' && <FilterSourceFields source={source} onChange={setSource} />}
                {source.type === 'sprint' && (
                    <SprintSourceFields source={source} sprints={sprints} onChange={setSource} />
                )}

                <Field label={t('board.editor.name')}>
                    <Input
                        value={draft.name}
                        placeholder={t('board.editor.namePlaceholder')}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                </Field>

                <ColumnsEditor
                    columns={draft.columns}
                    statuses={statuses}
                    suggestion={suggestion}
                    onUpdate={updateColumns}
                />

                <BoardNotificationsFields value={notifications} onChange={setNotifications} />
            </div>
        </Dialog>
    )
}

function ProjectSourceFields({
    source,
    projects,
    onChange
}: {
    source: ProjectSource
    projects: ProjectsQuery
    onChange: SourceChange
}) {
    const { t } = useI18n()
    const placeholder = projects.isLoading ? t('common.loading') : t('common.select')
    const options = (projects.data ?? []).map((project) => ({
        value: String(project.id),
        label: project.parent ? `${project.parent.name} › ${project.name}` : project.name
    }))
    const pick = (option: PickOption) => {
        const project = projects.data?.find((candidate) => String(candidate.id) === option.value)
        onChange({ ...source, projectId: Number(option.value) }, project?.name)
    }
    return (
        <div className="grid grid-cols-2 items-end gap-4">
            <Field label={t('board.editor.project')}>
                <PickList
                    value={source.projectId ? String(source.projectId) : ''}
                    options={options}
                    placeholder={placeholder}
                    searchPlaceholder={t('issue.create.searchProject')}
                    noMatches={t('issue.create.noProject')}
                    onPick={pick}
                />
            </Field>
            <ToggleField
                checked={source.includeSubprojects}
                onChange={(includeSubprojects) => onChange({ ...source, includeSubprojects })}
                label={t('board.editor.includeSubprojects')}
            />
        </div>
    )
}

function QuerySourceFields({ source, onChange }: { source: QuerySource; onChange: SourceChange }) {
    const { t } = useI18n()
    return (
        <Field label={t('board.editor.query')} hint={t('board.editor.queryHint')}>
            <SavedQuerySelect
                queryId={source.queryId}
                onChange={(queryId, projectId, name) => onChange({ type: 'query', queryId, projectId }, name)}
            />
        </Field>
    )
}

function FilterSourceFields({ source, onChange }: { source: FilterSource; onChange: SourceChange }) {
    return <FilterUrlField url={source.url} onChange={(url) => onChange({ type: 'filter', url })} />
}

type NotificationsDraft = Pick<Monitor, 'enabled' | 'events'>

function initialNotifications(existing?: Monitor): NotificationsDraft {
    if (existing) return { enabled: existing.enabled, events: existing.events }
    return { enabled: false, events: defaultEvents('board') }
}

/** Switched off and never created: nothing to save. Switched off but it existed: its monitor is removed. */
function notificationsToSave(draft: NotificationsDraft, existing?: Monitor): BoardNotifications | undefined {
    if (draft.enabled) return draft
    if (existing) return null
    return undefined
}

function BoardNotificationsFields({
    value,
    onChange
}: {
    value: NotificationsDraft
    onChange: (value: NotificationsDraft) => void
}) {
    const { t } = useI18n()
    return (
        <div className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold">{t('board.editor.notifications')}</h3>
            <ToggleField
                checked={value.enabled}
                onChange={(enabled) => onChange({ ...value, enabled })}
                label={t('board.editor.notificationsEnabled')}
                description={t('board.editor.notificationsHint')}
            />
            {value.enabled && (
                <div className="mt-2 pl-12">
                    <MonitorEventsFields
                        sourceType="board"
                        events={value.events}
                        onChange={(events) => onChange({ ...value, events })}
                    />
                </div>
            )}
        </div>
    )
}

function SprintSourceFields({
    source,
    sprints,
    onChange
}: {
    source: SprintSource
    sprints: SprintsQuery
    onChange: SourceChange
}) {
    const { t } = useI18n()
    const selectedValue = source.auto ? `${AUTO_PREFIX}${source.auto}` : (source.versionId ?? '')
    const selectableSprints = sprints.all
        .filter((sprint) => sprint.version.status !== 'closed' || sprint.version.id === source.versionId)
        .sort((left, right) => compareVersions(right.version.name, left.version.name))

    const hint = () => {
        if (source.auto) return t('board.editor.autoHint')
        if (!sprints.configured) return t('board.editor.configureHint')
        return undefined
    }

    const autoPickLabel = (autoPick: SprintAutoPick) => {
        const currentSprint = sprints.pick(autoPick)
        const suffix = currentSprint ? t('board.editor.todayIs', { name: currentSprint.version.name }) : ''
        return `${t(`sprint.auto.${autoPick}`)}${suffix}`
    }
    const options: PickOption[] = [
        ...AUTO_PICKS.map((autoPick) => ({
            value: `${AUTO_PREFIX}${autoPick}`,
            label: autoPickLabel(autoPick),
            group: t('board.editor.automaticGroup')
        })),
        ...selectableSprints.map((sprint) => ({
            value: String(sprint.version.id),
            label: `${sprint.version.name} · ${t(`sprint.phase.${sprint.phase}`)}`,
            group: t('board.editor.fixedGroup')
        }))
    ]

    const selectSprint = (value: string) => {
        if (value.startsWith(AUTO_PREFIX)) {
            const auto = value.slice(AUTO_PREFIX.length) as SprintAutoPick
            onChange({ ...source, auto, versionId: undefined }, t(`sprint.auto.${auto}`))
            return
        }
        const versionName = selectableSprints.find((sprint) => String(sprint.version.id) === value)?.version.name
        onChange({ ...source, auto: undefined, versionId: Number(value) || undefined }, versionName)
    }

    return (
        <div className="grid grid-cols-2 items-end gap-4">
            <Field label={t('board.editor.sprint')} hint={hint()}>
                <PickList
                    value={String(selectedValue)}
                    options={options}
                    onPick={(option) => selectSprint(option.value)}
                />
            </Field>
            <ToggleField
                checked={Boolean(source.onlyMine)}
                onChange={(onlyMine) => onChange({ ...source, onlyMine })}
                label={t('board.editor.onlyMine')}
            />
        </div>
    )
}

type Suggestion = ReturnType<typeof useSuggestedColumns>

/**
 * Columns from the statuses the source's issues are in. They fill an empty board as soon as the source is complete,
 * and follow the source while the user has not changed them.
 */
function useSuggestedColumns(draft: Board, statuses: StatusesQuery, onUpdate: ColumnsUpdater) {
    const { t } = useI18n()
    const query = useColumnSuggestion(draft)
    const lastSuggested = useRef<BoardColumn[] | undefined>(undefined)
    const closedLabel = t('board.editor.closedColumn')
    const build = () => {
        if (!query.data || !statuses.data) return undefined
        return columnsFromStatuses(suggestedStatuses(statuses.data, query.data.statusIds), localId, closedLabel)
    }
    const apply = (onlyIfUntouched: boolean) => {
        const columns = build()
        if (!columns?.length) return
        const untouchedBefore = lastSuggested.current
        onUpdate((current) => {
            const untouched = current.length === 0 || current === untouchedBefore
            return onlyIfUntouched && !untouched ? current : columns
        })
        lastSuggested.current = columns
    }

    useEffect(() => {
        apply(true)
        // Only when a new suggestion arrives.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query.data, statuses.data])

    return { total: query.data?.total, loading: query.isFetching, apply: () => apply(false) }
}

function ColumnsEditor({
    columns,
    statuses,
    suggestion,
    onUpdate
}: {
    columns: BoardColumn[]
    statuses: StatusesQuery
    suggestion: Suggestion
    onUpdate: ColumnsUpdater
}) {
    const { t } = useI18n()
    const allStatuses = statuses.data ?? []
    const statusName = useMemo(
        () => new Map((statuses.data ?? []).map((status) => [status.id, status.name])),
        [statuses.data]
    )
    const usedStatusIds = new Set(columns.flatMap((column) => column.statusIds))
    const freeStatuses = allStatuses.filter((status) => !usedStatusIds.has(status.id))

    const patchColumn = (id: string, patch: (column: BoardColumn) => BoardColumn) =>
        onUpdate((current) => current.map((column) => (column.id === id ? patch(column) : column)))
    const moveColumn = (index: number, delta: number) => onUpdate((current) => moveItem(current, index, delta))
    const removeColumn = (id: string) => onUpdate((current) => current.filter((column) => column.id !== id))

    const createOnePerStatus = () => {
        onUpdate(() => columnsFromStatuses(allStatuses, localId, t('board.editor.closedColumn')))
    }
    const addColumn = () => {
        const newColumn = { id: localId(), name: t('board.editor.newColumn'), statusIds: [] }
        onUpdate((current) => [...current, newColumn])
    }

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">{t('board.editor.columns')}</h3>
                    <p className="text-xs text-muted">{t('board.editor.columnsHint')}</p>
                    {suggestion.total !== undefined && (
                        <p className="text-xs text-muted">
                            {t('board.editor.suggestedFrom', { count: suggestion.total })}
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button onClick={suggestion.apply} disabled={!suggestion.total || suggestion.loading}>
                        {t('board.editor.suggest')}
                    </Button>
                    <Button onClick={createOnePerStatus} disabled={!statuses.data}>
                        {t('board.editor.onePerStatus')}
                    </Button>
                    <Button onClick={addColumn}>
                        <Plus size={14} /> {t('board.editor.addColumn')}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {columns.map((column, index) => (
                    <ColumnRow
                        key={column.id}
                        column={column}
                        isFirst={index === 0}
                        isLast={index === columns.length - 1}
                        statusName={statusName}
                        freeStatuses={freeStatuses}
                        onMove={(delta) => moveColumn(index, delta)}
                        onPatch={(patch) => patchColumn(column.id, patch)}
                        onRemove={() => removeColumn(column.id)}
                    />
                ))}
                {columns.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
                        {t('board.editor.noColumns')}
                    </p>
                )}
            </div>
        </div>
    )
}

function ColumnRow({
    column,
    isFirst,
    isLast,
    statusName,
    freeStatuses,
    onMove,
    onPatch,
    onRemove
}: {
    column: BoardColumn
    isFirst: boolean
    isLast: boolean
    statusName: Map<number, string>
    freeStatuses: IssueStatus[]
    onMove: (delta: number) => void
    onPatch: (patch: (column: BoardColumn) => BoardColumn) => void
    onRemove: () => void
}) {
    const { t } = useI18n()

    const rename = (name: string) => onPatch((current) => ({ ...current, name }))
    const removeStatus = (statusId: number) =>
        onPatch((current) => ({ ...current, statusIds: current.statusIds.filter((id) => id !== statusId) }))
    const addStatus = (statusId: number) =>
        onPatch((current) => ({ ...current, statusIds: [...current.statusIds, statusId] }))

    return (
        <div className="flex items-start gap-2 rounded-lg border border-line bg-panel-2 p-2">
            <div className="flex flex-col">
                <button
                    className="rounded p-0.5 text-muted hover:text-fg disabled:opacity-30"
                    disabled={isFirst}
                    onClick={() => onMove(-1)}
                >
                    <ArrowUp size={13} />
                </button>
                <button
                    className="rounded p-0.5 text-muted hover:text-fg disabled:opacity-30"
                    disabled={isLast}
                    onClick={() => onMove(1)}
                >
                    <ArrowDown size={13} />
                </button>
            </div>
            <Input className="w-44" value={column.name} onChange={(event) => rename(event.target.value)} />
            <div className="flex min-h-8 flex-1 flex-wrap items-center gap-1">
                {column.statusIds.map((statusId) => (
                    <span
                        key={statusId}
                        className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-panel px-2 text-xs"
                    >
                        {statusName.get(statusId) ?? `#${statusId}`}
                        <button className="text-muted hover:text-fg" onClick={() => removeStatus(statusId)}>
                            <X size={11} />
                        </button>
                    </span>
                ))}
                {freeStatuses.length > 0 && (
                    <AddSelect className="h-6 px-1" onChange={(event) => addStatus(Number(event.target.value))}>
                        <option value="">{t('board.editor.addStatus')}</option>
                        {freeStatuses.map((status) => (
                            <option key={status.id} value={status.id}>
                                {status.name}
                            </option>
                        ))}
                    </AddSelect>
                )}
            </div>
            <IconButton
                label={t('board.editor.removeColumn')}
                tone="danger"
                icon={<Trash2 size={14} />}
                onClick={onRemove}
            />
        </div>
    )
}
