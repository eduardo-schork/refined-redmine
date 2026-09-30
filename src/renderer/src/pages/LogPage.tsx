import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownUp, Gauge, HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import { summarizeLog, type LogEntry, type LogLevel } from '@domain/log/log-entry'
import { describeLogEntry, formatBytes, formatMilliseconds } from '@shared/i18n/format/log'
import { useActivityLog, useClearActivityLog } from '@/hooks/activity-log'
import { useMonitorName } from '@/hooks/monitor-name'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/atoms/Button'
import { IconButton } from '@/ui/atoms/IconButton'
import { SearchInput } from '@/ui/molecules/SearchInput'
import { SegmentedControl } from '@/ui/molecules/SegmentedControl'
import { StatTile } from '@/ui/molecules/surfaces'
import { PageLayout } from '@/ui/templates/layouts'

type LogFilter = 'all' | 'http' | 'monitor' | 'errors'

const MAX_ROWS = 500

const LEVEL_COLORS: Record<LogLevel, string> = {
    info: 'bg-muted/40',
    warn: 'bg-warn',
    error: 'bg-danger'
}

const MATCHES_FILTER: Record<LogFilter, (entry: LogEntry) => boolean> = {
    all: () => true,
    http: (entry) => entry.type === 'http',
    monitor: (entry) => entry.type === 'monitor',
    errors: (entry) => entry.level !== 'info'
}

export default function LogPage() {
    const { t, locale } = useI18n()
    const log = useActivityLog()
    const clear = useClearActivityLog()
    const monitorName = useMonitorName()
    const [filter, setFilter] = useState<LogFilter>('all')
    const [search, setSearch] = useState('')

    const rows = useMemo(() => {
        const entries = log.data ?? []
        const needle = search.trim().toLowerCase()
        const withText = entries.map((entry) => ({ entry, text: describeLogEntry(entry, t, monitorName, locale) }))
        return withText.filter(({ entry, text }) => {
            const matchesSearch = !needle || text.toLowerCase().includes(needle)
            return MATCHES_FILTER[filter](entry) && matchesSearch
        })
    }, [log.data, filter, search, t, monitorName, locale])

    const summary = summarizeLog(rows.map((row) => row.entry))

    function confirmClear() {
        if (!confirm(t('log.confirmClear'))) return
        clear.mutate()
    }

    const filterOptions = (['all', 'http', 'monitor', 'errors'] as const).map((value) => ({
        value,
        label: t(`log.${value}`)
    }))

    return (
        <PageLayout
            title={t('log.title')}
            actions={
                <>
                    <IconButton
                        label={t('common.refresh')}
                        icon={<RefreshCw size={14} className={cn(log.isFetching && 'animate-spin')} />}
                        onClick={() => void log.refetch()}
                    />
                    <Button variant="danger" onClick={confirmClear}>
                        <Trash2 size={14} /> {t('log.clear')}
                    </Button>
                </>
            }
        >
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
                <div className="grid grid-cols-4 gap-3">
                    <StatTile
                        label={t('log.summary.requests')}
                        value={summary.requests}
                        icon={<ArrowDownUp size={13} />}
                    />
                    <StatTile
                        label={t('log.summary.errors')}
                        value={summary.errors}
                        icon={<AlertTriangle size={13} />}
                        tone={summary.errors ? 'danger' : undefined}
                    />
                    <StatTile
                        label={t('log.summary.average')}
                        value={formatMilliseconds(summary.averageMs, locale)}
                        icon={<Gauge size={13} />}
                    />
                    <StatTile
                        label={t('log.summary.size')}
                        value={formatBytes(summary.totalBytes, locale)}
                        icon={<HardDrive size={13} />}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <SegmentedControl value={filter} options={filterOptions} onChange={setFilter} />
                    <SearchInput className="w-80" value={search} onChange={setSearch} placeholder={t('log.search')} />
                    <span className="ml-auto text-xs text-muted">{t('log.hint')}</span>
                </div>
                <LogTable rows={rows.slice(0, MAX_ROWS)} />
            </div>
        </PageLayout>
    )
}

function LogTable({ rows }: { rows: { entry: LogEntry; text: string }[] }) {
    const { t, dates } = useI18n()
    if (!rows.length) return <div className="py-16 text-center text-sm text-muted">{t('log.empty')}</div>
    return (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-line">
            {rows.map(({ entry, text }) => (
                <div
                    key={entry.id}
                    className="flex items-start gap-3 border-b border-line px-3 py-1.5 font-mono text-xs last:border-b-0"
                >
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', LEVEL_COLORS[entry.level])} />
                    <span className="w-36 shrink-0 text-muted">
                        {dates.format(new Date(entry.at), {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })}
                    </span>
                    <span className="w-20 shrink-0 text-muted">{t(`log.${entry.type}`)}</span>
                    <span className={cn('min-w-0 flex-1 break-all', entry.level === 'error' && 'text-danger')}>
                        {text}
                    </span>
                </div>
            ))}
        </div>
    )
}
