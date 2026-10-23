import { useMemo, useState } from 'react'
import { CalendarRange, ListChecks, Pencil, Plus, Sigma, User } from 'lucide-react'
import { displayName, type Issue } from '@domain/redmine/entities'
import { parseLocal, type LocalDate } from '@domain/shared/date'
import {
    daysOf,
    focusedEntries,
    groupEntries,
    periodRange,
    teamSheet,
    type EntryGrouping,
    type Team,
    type TeamFocus,
    type TeamPeriod,
    type TeamSheet
} from '@domain/time/team'
import type { TimeEntry } from '@domain/time/time-entry'
import { useSettings } from '@/hooks/session'
import { useTeamTime } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/atoms/Button'
import { Input, Select } from '@/ui/atoms/fields'
import { SegmentedControl } from '@/ui/molecules/SegmentedControl'
import { Alert, EmptyRow, Panel, StatTile } from '@/ui/molecules/surfaces'
import { useOpenIssue } from '@/ui/organisms/IssueModal'
import { TeamEditorDialog } from '@/ui/organisms/time/TeamEditorDialog'
import { PageLayout } from '@/ui/templates/layouts'

const MY_TIME = 'me'
const PERIODS: TeamPeriod[] = ['today', 'thisWeek', 'lastWeek', 'thisMonth']
type PeriodChoice = TeamPeriod | 'custom'
/** Longer periods make the grid unreadable and cost one listing per person anyway. */
const MAX_DAYS = 62

/** "Meu tempo" first (always there), then the saved teams. */
function useTeams(): Team[] {
    const { t } = useI18n()
    const settings = useSettings()
    const me = settings.user
    const myTime: Team = {
        id: MY_TIME,
        name: t('team.myTime'),
        members: me ? [{ id: me.id, name: displayName(me) }] : []
    }
    return [myTime, ...settings.teams]
}

function usePeriod() {
    const [period, setPeriod] = useState<PeriodChoice>('thisWeek')
    const [custom, setCustom] = useState(() => periodRange('thisWeek', new Date()))
    const range = period === 'custom' ? custom : periodRange(period, new Date())
    const days = daysOf(range.from, range.to).slice(0, MAX_DAYS)
    return { period, setPeriod, custom, setCustom, range, days }
}

/** Hours of a team per person and day, with averages and the detail by issue or kind of work. */
export default function TeamTimePage() {
    const { t } = useI18n()
    const teams = useTeams()
    const [teamId, setTeamId] = useState(MY_TIME)
    const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0]
    const period = usePeriod()
    const [focus, setFocus] = useState<TeamFocus>({})
    const [editing, setEditing] = useState<Team | 'new'>()
    const memberIds = team.members.map((member) => member.id)
    const time = useTeamTime(memberIds, period.days[0], period.days.at(-1) ?? period.days[0])
    const entries = useMemo(() => time.data?.entries ?? [], [time.data])
    const sheet = useMemo(() => teamSheet(entries, team.members, period.days), [entries, team.members, period.days])

    const pickTeam = (id: string) => {
        setTeamId(id)
        setFocus({})
    }
    const actions = (
        <>
            <Select className="w-56" value={team.id} onChange={(event) => pickTeam(event.target.value)}>
                {teams.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                    </option>
                ))}
            </Select>
            {team.id !== MY_TIME && (
                <Button onClick={() => setEditing(team)}>
                    <Pencil size={14} /> {t('team.edit')}
                </Button>
            )}
            <Button onClick={() => setEditing('new')}>
                <Plus size={14} /> {t('team.new')}
            </Button>
        </>
    )

    return (
        <PageLayout title={t('nav.team')} actions={actions} width="xl">
            <PeriodPicker period={period} onChange={() => setFocus({})} />
            {time.isError && <Alert>{t('team.loadError')}</Alert>}
            <TeamStats sheet={sheet} members={team.members.length} />
            <TeamGrid sheet={sheet} focus={focus} onFocus={setFocus} loading={time.isLoading} />
            <TeamDetail
                entries={focusedEntries(entries, focus)}
                issues={time.data?.issues ?? {}}
                sheet={sheet}
                focus={focus}
                onClear={() => setFocus({})}
            />
            <p className="text-xs text-muted">{t('team.permissionNote')}</p>
            {editing && (
                <TeamEditorDialog
                    team={editing === 'new' ? undefined : editing}
                    onClose={() => setEditing(undefined)}
                    onSaved={pickTeam}
                />
            )}
        </PageLayout>
    )
}

function PeriodPicker({ period, onChange }: { period: ReturnType<typeof usePeriod>; onChange: () => void }) {
    const { t } = useI18n()
    const options = [...PERIODS, 'custom' as const].map((value) => ({ value, label: t(`team.periods.${value}`) }))
    const choose = (value: PeriodChoice) => {
        period.setPeriod(value)
        onChange()
    }
    return (
        <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl value={period.period} options={options} onChange={choose} />
            {period.period === 'custom' && (
                <div className="flex items-center gap-2 text-sm">
                    <Input
                        type="date"
                        className="w-40"
                        value={period.custom.from}
                        onChange={(event) => period.setCustom({ ...period.custom, from: event.target.value })}
                    />
                    <span className="text-muted">{t('team.until')}</span>
                    <Input
                        type="date"
                        className="w-40"
                        value={period.custom.to}
                        onChange={(event) => period.setCustom({ ...period.custom, to: event.target.value })}
                    />
                </div>
            )}
        </div>
    )
}

function TeamStats({ sheet, members }: { sheet: TeamSheet; members: number }) {
    const { t, dates } = useI18n()
    return (
        <div className="grid grid-cols-4 gap-3">
            <StatTile label={t('team.total')} value={dates.hours(sheet.total)} icon={<Sigma size={14} />} />
            <StatTile label={t('team.perPerson')} value={dates.hours(sheet.perPerson)} icon={<User size={14} />} />
            <StatTile
                label={t('team.perPersonPerWorkday')}
                value={dates.hours(sheet.perPersonPerWorkday)}
                icon={<CalendarRange size={14} />}
            />
            <StatTile
                label={t('team.entries', { people: sheet.contributors, members })}
                value={sheet.entryCount}
                icon={<ListChecks size={14} />}
            />
        </div>
    )
}

/** Up to 14 hours a day gets the strongest shade; beyond that it stays the same. */
const heat = (hours: number) =>
    hours ? `color-mix(in srgb, var(--accent) ${Math.min(hours / 14, 0.35) * 100}%, transparent)` : undefined

function TeamGrid({
    sheet,
    focus,
    onFocus,
    loading
}: {
    sheet: TeamSheet
    focus: TeamFocus
    onFocus: (focus: TeamFocus) => void
    loading: boolean
}) {
    const { t, dates } = useI18n()
    const isFocused = (memberId?: number, day?: LocalDate) => focus.memberId === memberId && focus.day === day
    const clickable = (selected: boolean) =>
        cn(
            'cursor-default py-1.5 hover:outline hover:outline-1 hover:outline-accent/50',
            selected && 'outline outline-2 outline-accent'
        )
    const cellClass = (selected: boolean) => cn(clickable(selected), 'px-2 text-right tabular-nums')
    return (
        <Panel title={t('team.grid')} hint={loading ? t('team.loading') : t('team.gridHint')}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-muted">
                            <th className="px-4 py-1.5 text-left font-medium">{t('team.person')}</th>
                            {sheet.days.map((day) => (
                                <th key={day} className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                                    {dates.weekdayShort(parseLocal(day).getDay())} {dates.date(day)}
                                </th>
                            ))}
                            <th className="px-4 py-1.5 text-right font-medium">{t('team.totalColumn')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sheet.rows.map((row) => (
                            <tr key={row.member.id} className="border-t border-line">
                                <td
                                    className={cn(
                                        clickable(isFocused(row.member.id)),
                                        'whitespace-nowrap px-4 text-left'
                                    )}
                                    onClick={() => onFocus({ memberId: row.member.id })}
                                >
                                    {row.member.name}
                                </td>
                                {sheet.days.map((day) => (
                                    <td
                                        key={day}
                                        className={cellClass(isFocused(row.member.id, day))}
                                        style={{ background: heat(row.byDay[day] ?? 0) }}
                                        onClick={() => onFocus({ memberId: row.member.id, day })}
                                    >
                                        {row.byDay[day] ? dates.hours(row.byDay[day]) : ''}
                                    </td>
                                ))}
                                <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                                    {dates.hours(row.total)}
                                </td>
                            </tr>
                        ))}
                        <tr className="border-t border-line bg-panel-2 font-medium">
                            <td className="px-4 py-1.5">{t('team.teamTotal')}</td>
                            {sheet.days.map((day) => (
                                <td
                                    key={day}
                                    className={cellClass(isFocused(undefined, day))}
                                    onClick={() => onFocus({ day })}
                                >
                                    {sheet.dayTotals[day] ? dates.hours(sheet.dayTotals[day]) : ''}
                                </td>
                            ))}
                            <td className="px-4 py-1.5 text-right tabular-nums">{dates.hours(sheet.total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Panel>
    )
}

function TeamDetail({
    entries,
    issues,
    sheet,
    focus,
    onClear
}: {
    entries: TimeEntry[]
    issues: Record<number, Issue>
    sheet: TeamSheet
    focus: TeamFocus
    onClear: () => void
}) {
    const { t, dates } = useI18n()
    const [grouping, setGrouping] = useState<EntryGrouping>('issue')
    const groups = groupEntries(entries, grouping)
    const person = sheet.rows.find((row) => row.member.id === focus.memberId)?.member.name
    const scope = [person, focus.day ? dates.date(focus.day) : undefined].filter(Boolean).join(' · ')
    const header = (
        <div className="flex items-center gap-2">
            {scope && (
                <Button variant="ghost" className="h-7 px-2 text-xs" onClick={onClear}>
                    {scope} ✕
                </Button>
            )}
            <SegmentedControl
                value={grouping}
                options={[
                    { value: 'issue', label: t('team.byIssue') },
                    { value: 'activity', label: t('team.byActivity') }
                ]}
                onChange={setGrouping}
            />
        </div>
    )
    return (
        <Panel title={t('team.detail')} action={header}>
            {groups.length === 0 && <EmptyRow>{t('team.noEntries')}</EmptyRow>}
            {groups.map((group) => (
                <EntryGroupRows key={group.key} group={group} issues={issues} />
            ))}
        </Panel>
    )
}

function EntryGroupRows({
    group,
    issues
}: {
    group: ReturnType<typeof groupEntries>[number]
    issues: Record<number, Issue>
}) {
    const { t, dates } = useI18n()
    const [open, setOpen] = useState(false)
    const issue = group.issueId ? issues[group.issueId] : undefined
    const title = group.activity ?? (group.issueId ? `#${group.issueId} ${issue?.subject ?? ''}` : t('team.noIssue'))
    return (
        <div className="border-t border-line">
            <button
                className="flex w-full cursor-default items-center gap-3 px-4 py-2 text-left text-sm hover:bg-panel-2"
                onClick={() => setOpen(!open)}
            >
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <span className="text-xs text-muted">{t('team.entryCount', { count: group.entries.length })}</span>
                <span className="w-16 text-right font-medium tabular-nums">{dates.hours(group.hours)}</span>
            </button>
            {open &&
                group.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} byActivity={Boolean(group.activity)} />
                ))}
        </div>
    )
}

/** Inside an issue group the activity is the useful detail; inside an activity group, the issue. */
function EntryRow({ entry, byActivity }: { entry: TimeEntry; byActivity: boolean }) {
    const { dates } = useI18n()
    const openIssue = useOpenIssue()
    const issueId = entry.issue?.id
    const issueLink = issueId ? (
        <button className="text-accent hover:underline" onClick={() => openIssue(issueId)}>
            #{issueId}
        </button>
    ) : null
    return (
        <div className="flex items-center gap-3 bg-panel-2/50 px-6 py-1.5 text-xs">
            <span className="w-32 truncate">{entry.user.name}</span>
            <span className="w-14 text-muted">{dates.date(entry.spent_on)}</span>
            <span className="w-28 truncate text-muted">{byActivity ? issueLink : entry.activity.name}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{entry.comments}</span>
            <span className="w-12 text-right tabular-nums">{dates.hours(entry.hours)}</span>
        </div>
    )
}
