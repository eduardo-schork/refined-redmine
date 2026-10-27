import { useMemo, useState } from 'react'
import type { Issue } from '@domain/redmine/entities'
import { daysUntil } from '@domain/shared/date'
import type { Sprint } from '@domain/sprint/sprint'
import { teamCapacity, type CapacityTotals, type TeamCapacity } from '@domain/sprint/team-capacity'
import type { Team } from '@domain/time/team'
import { useSettings } from '@/hooks/session'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { useIssueStyle } from '@/lib/issue-style'
import { Avatar } from '../atoms/Avatar'
import { Select } from '../atoms/fields'
import { Card } from '../molecules/surfaces'

const TEAM_STORAGE_KEY = 'refined-redmine.capacity-team'

function loadTeamId(): string | undefined {
    try {
        return localStorage.getItem(TEAM_STORAGE_KEY) ?? undefined
    } catch {
        return undefined
    }
}

function saveTeamId(teamId: string): void {
    try {
        localStorage.setItem(TEAM_STORAGE_KEY, teamId)
    } catch {
        // Storage unavailable: the first team shows next time.
    }
}

/** The team last chosen on this computer, or the first saved one. */
function useCapacityTeam(teams: Team[]) {
    const [teamId, setTeamId] = useState(loadTeamId)
    const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0]
    const pick = (nextId: string) => {
        setTeamId(nextId)
        saveTeamId(nextId)
    }
    return { team, pick }
}

/** The period counted: "until the deadline" while development is going on, "from … to …" for an upcoming sprint. */
function useCapacityPeriod(sprint: Sprint, devDeadline: string) {
    const { t, dates } = useI18n()
    const to = dates.date(devDeadline)
    const upcoming = sprint.devStart && daysUntil(sprint.devStart, new Date()) > 0
    if (upcoming) {
        const from = dates.date(sprint.devStart)
        return {
            title: t('board.capacity.titleRange', { from, to }),
            window: t('board.capacity.windowRange', { from, to })
        }
    }
    return { title: t('board.capacity.title', { date: to }), window: t('board.capacity.windowFromNow', { to }) }
}

/** On a sprint board's summary: the capacity in a card, with the period in the title. */
export function TeamCapacityCard({
    sprint,
    devDeadline,
    issues
}: {
    sprint: Sprint
    devDeadline: string
    issues: Issue[]
}) {
    const { t } = useI18n()
    return (
        <Card title={useCapacityPeriod(sprint, devDeadline).title} description={t('board.capacity.hint')}>
            <TeamCapacityView sprint={sprint} devDeadline={devDeadline} issues={issues} />
        </Card>
    )
}

/**
 * For each person of the chosen team, the working hours of the sprint's development window against the hours their
 * issues still need, to know who can take more and who is already full. Also in the Sprints screen.
 */
export function TeamCapacityView({
    sprint,
    devDeadline,
    issues
}: {
    sprint: Sprint
    devDeadline: string
    issues: Issue[]
}) {
    const { t } = useI18n()
    const settings = useSettings()
    const rules = useIssueStyle()
    const { team, pick } = useCapacityTeam(settings.teams)
    const schedule = settings.workSchedule
    const devStart = sprint.devStart
    const capacity = useMemo(() => {
        if (!team) return undefined
        return teamCapacity({ issues, members: team.members, devStart, devDeadline, now: new Date(), schedule, rules })
    }, [team, issues, devStart, devDeadline, schedule, rules])
    const deadlinePassed = daysUntil(devDeadline, new Date()) < 0
    const period = useCapacityPeriod(sprint, devDeadline)

    if (!team || !capacity) return <p className="text-sm text-muted">{t('board.capacity.noTeam')}</p>
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{t('board.capacity.team')}</span>
                <Select className="w-48" value={team.id} onChange={(event) => pick(event.target.value)}>
                    {settings.teams.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                        </option>
                    ))}
                </Select>
                <span className="text-xs text-muted">{period.window}</span>
                {deadlinePassed && <span className="text-sm text-warn">{t('board.capacity.deadlinePassed')}</span>}
            </div>
            <div className="rounded-lg border border-line">
                <CapacityTable capacity={capacity} />
            </div>
        </div>
    )
}

const COLUMNS = 'grid grid-cols-[minmax(0,1.6fr)_5rem_6rem_6rem_7.5rem] items-center gap-3'

function CapacityTable({ capacity }: { capacity: TeamCapacity }) {
    const { t, dates } = useI18n()
    return (
        <div className="overflow-hidden rounded-lg">
            <div className={cn(COLUMNS, 'px-4 py-2 text-2xs font-semibold uppercase tracking-wide text-muted')}>
                <span>{t('board.capacity.person')}</span>
                <span className="text-right">{t('board.capacity.issues')}</span>
                <span className="text-right">{t('board.capacity.remaining')}</span>
                <span className="text-right">{t('board.capacity.available')}</span>
                <span className="text-right">{t('board.capacity.balance')}</span>
            </div>
            {capacity.rows.map((row) => (
                <div key={row.member.id} className={cn(COLUMNS, 'border-t border-line px-4 py-2.5 text-sm')}>
                    <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={row.member.name} />
                        <span className="truncate">{row.member.name}</span>
                        {row.member.hoursPerDay && (
                            <span className="shrink-0 text-2xs text-muted">
                                {t('board.capacity.perDay', { hours: dates.hours(row.member.hoursPerDay) })}
                            </span>
                        )}
                    </span>
                    <CapacityNumbers values={row} />
                </div>
            ))}
            <div className={cn(COLUMNS, 'border-t border-line bg-panel-2/50 px-4 py-2.5 text-sm font-semibold')}>
                <span>{t('board.capacity.total')}</span>
                <CapacityNumbers values={capacity.total} />
            </div>
        </div>
    )
}

function CapacityNumbers({ values }: { values: CapacityTotals }) {
    const { dates } = useI18n()
    return (
        <>
            <span className="text-right tabular-nums">{values.pendingIssues}</span>
            <span className="text-right tabular-nums">{dates.hours(values.remainingHours)}</span>
            <span className="text-right tabular-nums text-muted">{dates.hours(values.availableHours)}</span>
            <Balance hours={values.balance} />
        </>
    )
}

/** Positive: time left for the backlog; negative: hours missing to finish by the deadline. */
function Balance({ hours }: { hours: number }) {
    const { t, dates } = useI18n()
    const missing = hours < 0
    const label = missing ? 'board.capacity.missing' : 'board.capacity.spare'
    return (
        <span className={cn('text-right font-semibold tabular-nums', missing ? 'text-danger' : 'text-ok')}>
            {t(label, { hours: dates.hours(Math.abs(hours)) })}
        </span>
    )
}
