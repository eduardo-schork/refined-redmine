import { useMemo } from 'react'
import { AlarmClock, CheckCircle2, ChevronsUp, CircleDot, Clock, Inbox, Pause, UserX } from 'lucide-react'
import type { Board } from '@domain/board/board'
import { summarizeBoard, type BoardSummary as Summary, type PersonSummary } from '@domain/board/board-summary'
import type { Issue } from '@domain/redmine/entities'
import type { Sprint } from '@domain/sprint/sprint'
import type { PriorityLevel } from '@domain/redmine/issue-signals'
import { useSettings } from '@/hooks/session'
import { useIssueStyle } from '@/lib/issue-style'
import { useI18n } from '@/lib/i18n'
import { STATUS_BACKGROUND } from '@/lib/status-colors'
import { cn } from '@/lib/cn'
import { Avatar } from '../atoms/Avatar'
import { ProgressBar } from '../atoms/misc'
import { DistributionBar, RankedBars } from '../molecules/DistributionBar'
import { Card, StatTile } from '../molecules/surfaces'
import { SprintProgressPanel } from './SprintProgressPanel'

/**
 * The board seen as numbers: totals, what needs attention, status distribution, people and breakdowns.
 * Uses every issue of the board, not only the ones the board filters show.
 */
export function BoardSummary({
    board,
    sprint,
    issues,
    onSelectPerson
}: {
    board: Board
    /** Present on sprint boards. */
    sprint?: Sprint
    issues: Issue[]
    onSelectPerson: (assigneeId: number | undefined) => void
}) {
    const { t } = useI18n()
    const staleDays = useSettings().dashboard.staleDays
    const rules = useIssueStyle()
    const summary = useMemo(() => {
        const statusOrder = board.columns.flatMap((column) => column.statusIds)
        return summarizeBoard(issues, statusOrder, { staleDays, now: new Date(), rules })
    }, [board.columns, issues, staleDays, rules])

    if (!summary.total) return <p className="p-6 text-sm text-muted">{t('board.summary.empty')}</p>

    return (
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            {sprint && <SprintProgressPanel sprint={sprint} issues={issues} />}
            <SummaryTiles summary={summary} />
            <Card title={t('board.summary.byStatus')} description={t('board.summary.byStatusHint')}>
                <DistributionBar
                    segments={summary.byStatus.map((slice) => ({
                        key: String(slice.statusId),
                        label: slice.name,
                        count: slice.count,
                        colorClass: STATUS_BACKGROUND[slice.tone]
                    }))}
                />
            </Card>
            <Card title={t('board.summary.people')} description={t('board.summary.peopleHint')}>
                <PeopleTable people={summary.byAssignee} onSelect={onSelectPerson} />
            </Card>
            <div className="grid grid-cols-2 gap-5">
                <Card title={t('board.summary.byTracker')}>
                    <RankedBars items={summary.byTracker} />
                </Card>
                <Card title={t('board.summary.byPriority')}>
                    <RankedBars
                        items={summary.byPriority.map((slice) => ({
                            ...slice,
                            colorClass: PRIORITY_BAR[slice.level]
                        }))}
                    />
                </Card>
            </div>
        </div>
    )
}

const PRIORITY_BAR: Record<PriorityLevel, string> = {
    urgent: 'bg-danger',
    high: 'bg-warn',
    normal: 'bg-st-progress/70',
    low: 'bg-st-new'
}

function SummaryTiles({ summary }: { summary: Summary }) {
    const { t, dates } = useI18n()
    const toneWhen = (value: number, tone: 'warn' | 'danger') => (value > 0 ? tone : undefined)
    return (
        <div className="grid grid-cols-4 gap-3 xl:grid-cols-8">
            <StatTile label={t('board.summary.total')} value={summary.total} icon={<Inbox size={15} />} />
            <StatTile label={t('board.summary.open')} value={summary.open} icon={<CircleDot size={15} />} />
            <StatTile
                label={t('board.summary.closed', { percent: summary.closedPercent })}
                value={summary.closed}
                icon={<CheckCircle2 size={15} />}
            />
            <StatTile
                label={t('board.summary.estimated')}
                value={dates.hours(summary.estimatedHours)}
                icon={<Clock size={15} />}
            />
            <StatTile
                label={t('board.summary.overdue')}
                value={summary.overdue}
                icon={<AlarmClock size={15} />}
                tone={toneWhen(summary.overdue, 'danger')}
            />
            <StatTile
                label={t('board.summary.highPriority')}
                value={summary.highPriority}
                icon={<ChevronsUp size={15} />}
                tone={toneWhen(summary.highPriority, 'warn')}
            />
            <StatTile
                label={t('board.summary.stale')}
                value={summary.stale}
                icon={<Pause size={15} />}
                tone={toneWhen(summary.stale, 'warn')}
            />
            <StatTile
                label={t('board.summary.unassigned')}
                value={summary.unassigned}
                icon={<UserX size={15} />}
                tone={toneWhen(summary.unassigned, 'warn')}
            />
        </div>
    )
}

const COLUMNS =
    'grid grid-cols-[minmax(0,1.6fr)_4.5rem_4.5rem_minmax(0,1.2fr)_4.5rem_4.5rem_4.5rem_5rem] items-center gap-3'

function PeopleTable({
    people,
    onSelect
}: {
    people: PersonSummary[]
    onSelect: (assigneeId: number | undefined) => void
}) {
    const { t } = useI18n()
    return (
        <div className="-mx-5 -my-4">
            <div className={cn(COLUMNS, 'px-5 py-2 text-2xs font-semibold uppercase tracking-wide text-muted')}>
                <span>{t('board.summary.person')}</span>
                <span className="text-right">{t('board.summary.open')}</span>
                <span className="text-right">{t('board.summary.closedShort')}</span>
                <span>{t('board.summary.progress')}</span>
                <span className="text-right">{t('board.summary.overdueShort')}</span>
                <span className="text-right">{t('board.summary.highShort')}</span>
                <span className="text-right">{t('board.summary.staleShort')}</span>
                <span className="text-right">{t('board.summary.estimatedShort')}</span>
            </div>
            {people.map((person) => (
                <PersonRow key={person.id ?? 'none'} person={person} onSelect={onSelect} />
            ))}
        </div>
    )
}

function Count({ value, tone }: { value: number; tone?: 'warn' | 'danger' }) {
    const toneClass = cn(tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')
    return (
        <span className={cn('text-right tabular-nums', value > 0 ? cn('font-semibold', toneClass) : 'text-muted')}>
            {value}
        </span>
    )
}

function PersonRow({ person, onSelect }: { person: PersonSummary; onSelect: (id: number | undefined) => void }) {
    const { t, dates } = useI18n()
    const percent = person.total ? Math.round((person.closed / person.total) * 100) : 0
    return (
        <button
            type="button"
            onClick={() => onSelect(person.id)}
            className={cn(
                COLUMNS,
                'w-full cursor-default border-t border-line px-5 py-2.5 text-left text-sm hover:bg-panel-2'
            )}
        >
            <span className="flex min-w-0 items-center gap-2">
                <Avatar name={person.name} />
                <span className={cn('truncate', !person.name && 'italic text-muted')}>
                    {person.name ?? t('board.noAssignee')}
                </span>
            </span>
            <span className="text-right font-semibold tabular-nums">{person.open}</span>
            <span className="text-right tabular-nums">{person.closed}</span>
            <span className="flex items-center gap-2">
                <ProgressBar value={percent} className="flex-1" />
                <span className="w-9 text-right text-xs text-muted">{percent}%</span>
            </span>
            <Count value={person.overdue} tone="danger" />
            <Count value={person.highPriority} tone="warn" />
            <Count value={person.stale} tone="warn" />
            <span className="text-right text-xs text-muted">
                {person.estimatedHours ? dates.hours(person.estimatedHours) : '—'}
            </span>
        </button>
    )
}
