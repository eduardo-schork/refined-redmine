import { useState } from 'react'
import {
    assertValidMonitor,
    defaultEvents,
    MINE_MONITOR_ID,
    type MineScopes,
    type Monitor,
    type MonitorSource,
    type MonitorSourceType
} from '@domain/monitor/monitor'
import { useSettings } from '@/hooks/session'
import { localId } from '@/lib/ids'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { Input, Select } from '../../atoms/fields'
import { Dialog } from '../../molecules/Dialog'
import { Field, ToggleField } from '../../molecules/Field'
import { DEFAULT_SCHEDULE, ScheduleFields } from '../../molecules/ScheduleFields'
import { useToast } from '../../molecules/Toast'
import { FilterUrlField } from '../FilterUrlField'
import { SavedQuerySelect } from '../SavedQuerySelect'
import { MonitorEventsFields } from './MonitorEventsFields'

type ExternalSourceType = Exclude<MonitorSourceType, 'mine'>

const EXTERNAL_SOURCE_TYPES: ExternalSourceType[] = ['query', 'filter', 'board']

const EMPTY_SOURCES: Record<ExternalSourceType, () => MonitorSource> = {
    query: () => ({ type: 'query', queryId: 0 }),
    filter: () => ({ type: 'filter', url: '' }),
    board: () => ({ type: 'board', boardId: '' })
}

function newMonitor(): Monitor {
    return { id: localId(), name: '', enabled: true, source: EMPTY_SOURCES.query(), events: defaultEvents('query') }
}

export function MonitorEditor({
    monitor,
    onClose,
    onSave
}: {
    monitor?: Monitor
    onClose: () => void
    onSave: (monitor: Monitor) => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const [draft, setDraft] = useState<Monitor>(() => structuredClone(monitor ?? newMonitor()))
    const isMine = draft.id === MINE_MONITOR_ID
    const patch = (fields: Partial<Monitor>) => setDraft((previous) => ({ ...previous, ...fields }))

    const changeSourceType = (type: ExternalSourceType) => {
        patch({ source: EMPTY_SOURCES[type](), events: defaultEvents(type) })
    }

    function submit() {
        try {
            assertValidMonitor(draft)
            onSave(draft)
        } catch (validationError) {
            toast(error(validationError), 'error')
        }
    }

    const footer = (
        <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={submit}>
                {t('common.save')}
            </Button>
        </>
    )

    return (
        <Dialog
            size="lg"
            title={monitor ? t('monitors.editTitle') : t('monitors.newTitle')}
            onClose={onClose}
            footer={footer}
        >
            <div className="flex flex-col gap-5">
                {isMine ? (
                    <h3 className="text-sm font-semibold">{t('monitors.mine')}</h3>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <Field label={t('monitors.name')}>
                            <Input
                                autoFocus
                                value={draft.name}
                                placeholder={t('monitors.namePlaceholder')}
                                onChange={(event) => patch({ name: event.target.value })}
                            />
                        </Field>
                        <Field label={t('monitors.source')}>
                            <Select
                                value={draft.source.type}
                                onChange={(event) => changeSourceType(event.target.value as ExternalSourceType)}
                            >
                                {EXTERNAL_SOURCE_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {t(`monitors.sourceType.${type}`)}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                )}

                <SourceFields draft={draft} onPatch={patch} />

                <div>
                    <h3 className="mb-1 text-xs font-medium text-muted">{t('monitors.events')}</h3>
                    <MonitorEventsFields
                        sourceType={draft.source.type}
                        events={draft.events}
                        onChange={(events) => patch({ events })}
                    />
                </div>

                <ScheduleFields
                    schedule={draft.schedule ?? { ...DEFAULT_SCHEDULE, enabled: false }}
                    label={t('monitors.ownSchedule')}
                    description={t('monitors.ownScheduleHint')}
                    onChange={(schedule) => patch({ schedule: schedule.enabled ? schedule : undefined })}
                />
            </div>
        </Dialog>
    )
}

function SourceFields({ draft, onPatch }: { draft: Monitor; onPatch: (fields: Partial<Monitor>) => void }) {
    const source = draft.source
    switch (source.type) {
        case 'mine':
            return (
                <MineScopesFields
                    scopes={source.scopes}
                    onChange={(scopes) => onPatch({ source: { ...source, scopes } })}
                />
            )
        case 'query':
            return <QueryFields draft={draft} onPatch={onPatch} />
        case 'filter':
            return <FilterUrlField url={source.url} onChange={(url) => onPatch({ source: { type: 'filter', url } })} />
        case 'board':
            return <BoardFields boardId={source.boardId} onPatch={onPatch} />
    }
}

function MineScopesFields({ scopes, onChange }: { scopes: MineScopes; onChange: (scopes: MineScopes) => void }) {
    const { t } = useI18n()
    return (
        <div>
            <h3 className="mb-1 text-xs font-medium text-muted">{t('monitors.scopes')}</h3>
            <ToggleField
                checked={scopes.assigned}
                onChange={(assigned) => onChange({ ...scopes, assigned })}
                label={t('settings.scopeAssigned')}
            />
            <ToggleField
                checked={scopes.watched}
                onChange={(watched) => onChange({ ...scopes, watched })}
                label={t('settings.scopeWatched')}
            />
            <ToggleField
                checked={scopes.authored}
                onChange={(authored) => onChange({ ...scopes, authored })}
                label={t('settings.scopeAuthored')}
            />
        </div>
    )
}

/** Picking a query also names the monitor, if it has no name yet. */
function QueryFields({ draft, onPatch }: { draft: Monitor; onPatch: (fields: Partial<Monitor>) => void }) {
    const { t } = useI18n()
    const queryId = draft.source.type === 'query' ? draft.source.queryId : undefined
    const select = (selectedId: number, projectId?: number, name?: string) => {
        const source: MonitorSource = { type: 'query', queryId: selectedId, projectId }
        const nameToUse = draft.name.trim() ? draft.name : (name ?? '')
        onPatch({ source, name: nameToUse })
    }
    return (
        <Field label={t('board.editor.query')}>
            <SavedQuerySelect queryId={queryId} onChange={select} />
        </Field>
    )
}

function BoardFields({ boardId, onPatch }: { boardId: string; onPatch: (fields: Partial<Monitor>) => void }) {
    const { t } = useI18n()
    const settings = useSettings()
    const select = (selectedId: string) => {
        const board = settings.boards.find((candidate) => candidate.id === selectedId)
        onPatch({ source: { type: 'board', boardId: selectedId }, name: board?.name ?? '' })
    }
    return (
        <Field label={t('monitors.board')} hint={t('monitors.boardHint')}>
            <Select value={boardId} onChange={(event) => select(event.target.value)}>
                <option value="">{t('common.select')}</option>
                {settings.boards.map((board) => (
                    <option key={board.id} value={board.id}>
                        {board.name}
                    </option>
                ))}
            </Select>
        </Field>
    )
}
