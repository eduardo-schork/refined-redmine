import { CalendarClock, Rocket } from 'lucide-react'
import type { Sprint, VersionStats } from '@domain/sprint/sprint'
import { useVersionStats } from '@/hooks/sprints'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { ProgressBar } from '../atoms/misc'
import { DateCountdown, PhaseBadge } from '../molecules/sprint'

export function SprintCard({ sprint, onOpen, compact }: { sprint: Sprint; onOpen?: () => void; compact?: boolean }) {
    const stats = useVersionStats(sprint.version.id)
    const showProgress = !compact || Boolean(stats.data)

    return (
        <button
            onClick={onOpen}
            className="flex w-full cursor-default flex-col gap-2.5 rounded-xl border border-line bg-panel p-4 text-left hover:border-muted/50"
        >
            <SprintHeader sprint={sprint} />
            <SprintDates sprint={sprint} />
            {showProgress && <SprintProgress stats={stats.data} isError={stats.isError} />}
        </button>
    )
}

function SprintHeader({ sprint }: { sprint: Sprint }) {
    const { t } = useI18n()
    const subtitle =
        sprint.kind === 'hotfix'
            ? t('sprint.hotfixOf', { base: sprint.baseName })
            : sprint.version.description || sprint.version.project.name

    return (
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
                <div className="text-2xl font-semibold leading-tight">{sprint.version.name}</div>
                <div className="truncate text-xs text-muted">{subtitle}</div>
            </div>
            <PhaseBadge phase={sprint.phase} />
        </div>
    )
}

function SprintDates({ sprint }: { sprint: Sprint }) {
    const { t } = useI18n()
    const { phase } = sprint
    const released = phase === 'production' || phase === 'released'
    const releaseLabel = released ? t('sprint.released') : t('sprint.release')
    const hasNoDates = !sprint.devDeadline && !sprint.release

    return (
        <div className="flex flex-col gap-1">
            <DateCountdown
                icon={<CalendarClock size={12} />}
                label={t('sprint.devDeadline')}
                date={sprint.devDeadline}
                highlight={phase === 'dev'}
            />
            <DateCountdown
                icon={<Rocket size={12} />}
                label={releaseLabel}
                date={sprint.release}
                highlight={phase === 'qa' || phase === 'late'}
            />
            {hasNoDates && <div className="text-xs text-muted">{t('sprints.noDates')}</div>}
        </div>
    )
}

function closedPercent(stats: VersionStats | undefined): number {
    if (!stats || !stats.total) return 0
    const closed = stats.total - stats.open
    return Math.round((closed / stats.total) * 100)
}

function SprintProgress({ stats, isError }: { stats?: VersionStats; isError: boolean }) {
    const { t } = useI18n()
    const percent = closedPercent(stats)

    return (
        <div className="mt-auto">
            <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted">
                    <ProgressLabel stats={stats} isError={isError} />
                </span>
                {stats && stats.total > 0 && <span className="font-medium">{percent}%</span>}
            </div>
            <ProgressBar value={percent} />
            {stats && (
                <div className="mt-2 flex gap-3 text-xs">
                    <span>
                        <b className="font-semibold">{stats.open}</b>{' '}
                        <span className="text-muted">{t('sprints.open', { count: stats.open })}</span>
                    </span>
                    <span className={cn(stats.mineOpen > 0 && 'text-accent')}>
                        <b className="font-semibold">{stats.mineOpen}</b>{' '}
                        <span className={cn(!stats.mineOpen && 'text-muted')}>
                            {t('sprints.mine', { count: stats.mineOpen })}
                        </span>
                    </span>
                </div>
            )}
        </div>
    )
}

function ProgressLabel({ stats, isError }: { stats?: VersionStats; isError: boolean }) {
    const { t } = useI18n()
    if (stats) {
        const closed = stats.total - stats.open
        return t('sprints.closedOf', { closed, total: stats.total })
    }
    if (isError) return t('sprints.countingError')
    return t('sprints.counting')
}
