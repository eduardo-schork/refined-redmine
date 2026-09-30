import { CalendarClock, CalendarPlus, Rocket } from 'lucide-react'
import type { Issue } from '@domain/redmine/entities'
import type { Sprint } from '@domain/sprint/sprint'
import { PACE_TOLERANCE, sprintProgress, type SprintPace, type SprintProgress } from '@domain/sprint/sprint-progress'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Card } from '../molecules/surfaces'
import { DateCountdown, PhaseBadge } from '../molecules/sprint'

const PACE_STYLES: Record<SprintPace, string> = {
    ahead: 'bg-ok/15 text-ok',
    onTrack: 'bg-ok/15 text-ok',
    behind: 'bg-danger/15 text-danger'
}

/** Sprint of a sprint board: dates, pace against the calendar and work left. */
export function SprintProgressPanel({ sprint, issues }: { sprint: Sprint; issues: Issue[] }) {
    const { t } = useI18n()
    const progress = sprintProgress(sprint, issues, new Date())
    const inDevelopment = sprint.phase === 'dev'
    return (
        <Card
            title={t('board.sprint.title', { name: sprint.version.name })}
            actions={<PhaseBadge phase={sprint.phase} />}
        >
            <div className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                    <DateCountdown
                        icon={<CalendarPlus size={13} />}
                        label={t('board.sprint.devStart')}
                        date={sprint.devStart}
                        highlight={false}
                    />
                    <DateCountdown
                        icon={<CalendarClock size={13} />}
                        label={t('sprint.devDeadline')}
                        date={sprint.devDeadline}
                        highlight={inDevelopment}
                    />
                    <DateCountdown
                        icon={<Rocket size={13} />}
                        label={t('sprint.release')}
                        date={sprint.release}
                        highlight={!inDevelopment}
                    />
                </div>
                <PaceBars progress={progress} />
                <WorkLeft progress={progress} />
            </div>
        </Card>
    )
}

function Bar({
    label,
    value,
    percent,
    colorClass
}: {
    label: string
    value: string
    percent: number
    colorClass: string
}) {
    return (
        <div className="grid grid-cols-[12rem_1fr_9rem] items-center gap-3 text-sm">
            <span className="text-muted">{label}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-panel-2">
                <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${percent}%` }} />
            </div>
            <span className="text-right font-medium tabular-nums">{value}</span>
        </div>
    )
}

/** Time gone next to work closed: the gap between the two bars is the pace. */
function PaceBars({ progress }: { progress: SprintProgress }) {
    const { t } = useI18n()
    const { elapsedPercent, closedPercent, pace } = progress
    return (
        <div className="flex flex-col gap-2">
            {elapsedPercent !== undefined && (
                <Bar
                    label={t('board.sprint.timeGone')}
                    value={t('board.sprint.timeGoneValue', { percent: elapsedPercent })}
                    percent={elapsedPercent}
                    colorClass="bg-st-progress/70"
                />
            )}
            <Bar
                label={t('board.sprint.closed')}
                value={t('board.sprint.closedValue', { percent: closedPercent })}
                percent={closedPercent}
                colorClass="bg-ok"
            />
            {pace && (
                <div className="flex items-center gap-2 text-xs">
                    <span className={cn('rounded px-2 py-0.5 font-semibold', PACE_STYLES[pace])}>
                        {t(`board.sprint.pace.${pace}`)}
                    </span>
                    <span className="text-muted">{t('board.sprint.paceHint', { tolerance: PACE_TOLERANCE })}</span>
                </div>
            )}
        </div>
    )
}

function Fact({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'warn' }) {
    return (
        <div className="rounded-lg bg-panel-2 px-3 py-2">
            <div className="text-xs text-muted">{label}</div>
            <div className={cn('text-xl font-semibold tabular-nums', tone === 'warn' && 'text-warn')}>{value}</div>
            {hint && <div className="text-2xs text-muted">{hint}</div>}
        </div>
    )
}

function WorkLeft({ progress }: { progress: SprintProgress }) {
    const { t, dates, locale } = useI18n()
    const added = progress.addedAfterStart
    const perDay = progress.openPerWorkingDay
    return (
        <div className="grid grid-cols-4 gap-3">
            <Fact label={t('board.sprint.closedLastWeek')} value={progress.closedLastWeek} />
            {perDay !== undefined && (
                <Fact
                    label={t('board.sprint.perDay')}
                    value={perDay.toLocaleString(locale)}
                    hint={t('board.sprint.workingDaysLeft', { count: progress.workingDaysLeft })}
                />
            )}
            {added !== undefined && (
                <Fact
                    label={t('board.sprint.added')}
                    value={added}
                    hint={t('board.sprint.addedHint')}
                    tone={added > 0 ? 'warn' : undefined}
                />
            )}
            <Fact label={t('board.sprint.remaining')} value={dates.hours(progress.remainingEstimate)} />
        </div>
    )
}
