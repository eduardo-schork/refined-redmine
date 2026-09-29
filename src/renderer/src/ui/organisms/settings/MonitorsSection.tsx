import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { availableEvents, MINE_MONITOR_ID, type MineScopes, type Monitor } from '@domain/monitor/monitor'
import { useSavedQueries } from '@/hooks/reference'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { Switch } from '../../atoms/Switch'
import { Card } from '../../molecules/surfaces'
import { MonitorEditor } from '../monitors/MonitorEditor'

const MAX_URL_PREVIEW = 60

// undefined = closed; 'new' = creating; a monitor = editing it.
type EditorState = undefined | 'new' | Monitor

export function MonitorsSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const update = useUpdateSettings()
    const [editing, setEditing] = useState<EditorState>()
    const monitors = settings.monitors

    const saveMonitors = (nextMonitors: Monitor[]) => update.mutate({ monitors: nextMonitors })
    const replace = (changed: Monitor) => {
        const exists = monitors.some((monitor) => monitor.id === changed.id)
        const nextMonitors = exists
            ? monitors.map((monitor) => (monitor.id === changed.id ? changed : monitor))
            : [...monitors, changed]
        saveMonitors(nextMonitors)
    }
    const remove = (monitor: Monitor) => {
        if (!confirm(t('monitors.confirmDelete', { name: monitor.name }))) return
        saveMonitors(monitors.filter((candidate) => candidate.id !== monitor.id))
    }
    const saveFromEditor = (monitor: Monitor) => {
        replace(monitor)
        setEditing(undefined)
    }

    return (
        <Card
            title={t('monitors.title')}
            description={t('monitors.hint')}
            actions={
                <Button onClick={() => setEditing('new')}>
                    <Plus size={14} /> {t('monitors.add')}
                </Button>
            }
        >
            <div className="flex flex-col gap-2">
                {monitors.map((monitor) => (
                    <MonitorRow
                        key={monitor.id}
                        monitor={monitor}
                        onToggle={(enabled) => replace({ ...monitor, enabled })}
                        onEdit={() => setEditing(monitor)}
                        onRemove={() => remove(monitor)}
                    />
                ))}
            </div>
            {editing && (
                <MonitorEditor
                    monitor={editing === 'new' ? undefined : editing}
                    onClose={() => setEditing(undefined)}
                    onSave={saveFromEditor}
                />
            )}
        </Card>
    )
}

type Translate = ReturnType<typeof useI18n>['t']

function describeScopes(scopes: MineScopes, t: Translate): string {
    const scopeLabels = [
        scopes.assigned && t('settings.scopeAssigned'),
        scopes.watched && t('settings.scopeWatched'),
        scopes.authored && t('settings.scopeAuthored')
    ]
    return scopeLabels.filter(Boolean).join(' · ')
}

function shortUrl(url: string): string {
    if (url.length <= MAX_URL_PREVIEW) return url
    return `${url.slice(0, MAX_URL_PREVIEW)}…`
}

function useSourceDescription() {
    const { t } = useI18n()
    const settings = useSettings()
    const queries = useSavedQueries()

    const queryName = (queryId: number) => {
        const query = queries.data?.find((candidate) => candidate.id === queryId)
        return query?.name ?? t('monitors.unknownQuery', { id: queryId })
    }
    const boardName = (boardId: string) => {
        const board = settings.boards.find((candidate) => candidate.id === boardId)
        return board?.name ?? t('monitors.unknownBoard')
    }

    return (monitor: Monitor): string => {
        const source = monitor.source
        switch (source.type) {
            case 'mine':
                return describeScopes(source.scopes, t)
            case 'query':
                return t('monitors.describe.query', { name: queryName(source.queryId) })
            case 'filter':
                return t('monitors.describe.filter', { url: shortUrl(source.url) })
            case 'board':
                return t('monitors.describe.board', { name: boardName(source.boardId) })
        }
    }
}

function MonitorRow({
    monitor,
    onToggle,
    onEdit,
    onRemove
}: {
    monitor: Monitor
    onToggle: (enabled: boolean) => void
    onEdit: () => void
    onRemove: () => void
}) {
    const { t } = useI18n()
    const describe = useSourceDescription()
    const isMine = monitor.id === MINE_MONITOR_ID
    const name = isMine ? t('monitors.mine') : monitor.name
    const enabledEvents = availableEvents(monitor.source.type).filter((event) => monitor.events[event])
    const eventsSummary = enabledEvents.map((event) => t(`monitors.event.${event}`)).join(', ')

    return (
        <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <Switch checked={monitor.enabled} onChange={onToggle} label={name} />
            <button className="min-w-0 flex-1 cursor-default text-left" onClick={onEdit}>
                <div className={cn('truncate text-[13px] font-medium', !monitor.enabled && 'text-muted')}>{name}</div>
                <div className="truncate text-xs text-muted">{describe(monitor)}</div>
                <div className="truncate text-xs text-muted">{eventsSummary || t('monitors.off')}</div>
            </button>
            <IconButton label={t('common.edit')} icon={<Pencil size={14} />} onClick={onEdit} />
            {!isMine && <IconButton label={t('common.delete')} icon={<Trash2 size={14} />} onClick={onRemove} />}
        </div>
    )
}
