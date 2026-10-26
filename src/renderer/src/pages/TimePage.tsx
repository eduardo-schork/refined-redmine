import { type FormEvent, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Copy } from 'lucide-react'
import type { Issue } from '@domain/redmine/entities'
import { addDays, parseLocal, toLocalDate, type LocalDate } from '@domain/shared/date'
import type { TimeEntry } from '@domain/time/time-entry'
import { buildTimesheet, weekDays, type Timesheet, type TimesheetRow } from '@domain/time/timesheet'
import { useSettings } from '@/hooks/session'
import { useMyTime, useRepeatWeek } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/atoms/Button'
import { Input } from '@/ui/atoms/fields'
import { IconButton } from '@/ui/atoms/IconButton'
import { EmptyState, Panel } from '@/ui/molecules/surfaces'
import { useToast } from '@/ui/molecules/Toast'
import { useOpenIssue } from '@/ui/organisms/IssueModal'
import { TimeEntryRow } from '@/ui/organisms/time/IssueTimeSection'
import { TimeEntryDialog, type TimeEntryDialogProps } from '@/ui/organisms/time/TimeEntryDialog'
import { PageLayout } from '@/ui/templates/layouts'

type DialogState = Omit<TimeEntryDialogProps, 'onClose'> | null

function issueLabel(issueId: number | undefined, issues: Record<number, Issue>): string {
    if (!issueId) return ''
    const issue = issues[issueId]
    return issue ? `#${issueId} ${issue.subject}` : `#${issueId}`
}

/** "My hours": the signed-in user's week, issues × days, with totals, entries and "repeat last week". */
export default function TimePage() {
    const { t, dates } = useI18n()
    const weekStartsOn = useSettings().calendar.weekStartsOn
    const [anchor, setAnchor] = useState(() => new Date())
    const [dialog, setDialog] = useState<DialogState>(null)
    const days = useMemo(() => weekDays(anchor, weekStartsOn), [anchor, weekStartsOn])
    const from = days[0]
    const to = days[6]
    const week = useMyTime(from, to)
    const entries = useMemo(() => week.data?.entries ?? [], [week.data])
    const issues = week.data?.issues ?? {}
    const sheet = useMemo(() => buildTimesheet(entries, days), [entries, days])
    const moveWeek = (weeks: number) => setAnchor((current) => addDays(current, weeks * 7))

    const subtitle = (
        <span className="text-xs text-muted">
            {t('timePage.week', { from: dates.date(from), to: dates.date(to) })} · {dates.hours(sheet.total)}
        </span>
    )
    const actions = (
        <>
            <IconButton label={t('timePage.previous')} icon={<ChevronLeft size={16} />} onClick={() => moveWeek(-1)} />
            <Button onClick={() => setAnchor(new Date())}>{t('timePage.thisWeek')}</Button>
            <IconButton label={t('timePage.next')} icon={<ChevronRight size={16} />} onClick={() => moveWeek(1)} />
            <RepeatWeekButton weekStart={from} />
        </>
    )

    return (
        <PageLayout title={t('nav.time')} subtitle={subtitle} actions={actions} width="xl" loading={week.isFetching}>
            <DayTotals sheet={sheet} />
            <LogByNumber onPick={(issueId) => setDialog({ issue: { id: issueId } })} />
            {!week.isLoading && entries.length === 0 ? (
                <EmptyState
                    icon={<Clock size={32} />}
                    title={t('timePage.emptyTitle')}
                    text={t('timePage.emptyText')}
                />
            ) : (
                <>
                    <WeekGrid
                        sheet={sheet}
                        issues={issues}
                        onCell={(issueId, spentOn) =>
                            setDialog({
                                issue: { id: issueId, subject: issues[issueId]?.subject },
                                initial: { spentOn }
                            })
                        }
                    />
                    <WeekEntries
                        entries={entries}
                        issues={issues}
                        onEdit={(entry) => setDialog(editDialog(entry, issues))}
                    />
                </>
            )}
            {dialog && <TimeEntryDialog {...dialog} onClose={() => setDialog(null)} />}
        </PageLayout>
    )
}

function editDialog(entry: TimeEntry, issues: Record<number, Issue>): DialogState {
    const issueId = entry.issue?.id ?? 0
    return {
        issue: { id: issueId, subject: issues[issueId]?.subject },
        entryId: entry.id,
        initial: {
            spentOn: entry.spent_on,
            hours: entry.hours,
            activityId: entry.activity.id,
            comments: entry.comments
        }
    }
}

function DayTotals({ sheet }: { sheet: Timesheet }) {
    const { dates } = useI18n()
    const today = toLocalDate(new Date())
    return (
        <div className="grid grid-cols-7 gap-2">
            {sheet.days.map((day) => {
                const date = parseLocal(day)
                const weekend = date.getDay() === 0 || date.getDay() === 6
                const hours = sheet.dayTotals[day]
                return (
                    <div
                        key={day}
                        className={cn(
                            'rounded-xl border border-line bg-panel px-3 py-2',
                            day === today && 'border-accent',
                            weekend && 'opacity-70'
                        )}
                    >
                        <div className="text-xs text-muted first-letter:uppercase">
                            {dates.weekdayShort(date.getDay())} {dates.date(day)}
                        </div>
                        <div className={cn('text-xl font-semibold tabular-nums', !hours && 'text-muted')}>
                            {hours ? dates.hours(hours) : '—'}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/** To log on an issue that is not in the week yet: type its number. */
function LogByNumber({ onPick }: { onPick: (issueId: number) => void }) {
    const { t } = useI18n()
    const [typed, setTyped] = useState('')
    const issueId = Number(typed.replace('#', '').trim())
    const valid = Number.isInteger(issueId) && issueId > 0
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!valid) return
        onPick(issueId)
        setTyped('')
    }
    return (
        <form onSubmit={submit} className="flex items-center gap-2">
            <Input
                className="w-44"
                inputMode="numeric"
                placeholder={t('timePage.issueNumber')}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
            />
            <Button type="submit" disabled={!valid}>
                <Clock size={14} /> {t('time.log')}
            </Button>
        </form>
    )
}

function WeekGrid({
    sheet,
    issues,
    onCell
}: {
    sheet: Timesheet
    issues: Record<number, Issue>
    onCell: (issueId: number, spentOn: LocalDate) => void
}) {
    const { t, dates } = useI18n()
    const openIssue = useOpenIssue()
    const columns = 'grid grid-cols-[minmax(0,1fr)_repeat(7,4.5rem)_5rem] items-center'
    return (
        <Panel title={t('timePage.grid')} hint={t('timePage.gridHint')}>
            <div className={cn(columns, 'border-t border-line px-4 py-2 text-2xs font-semibold uppercase text-muted')}>
                <span>{t('timePage.issue')}</span>
                {sheet.days.map((day) => (
                    <span key={day} className="text-center">
                        {dates.weekdayShort(parseLocal(day).getDay())} {dates.date(day)}
                    </span>
                ))}
                <span className="text-right">{t('timePage.total')}</span>
            </div>
            {sheet.rows.map((row) => (
                <GridRow
                    key={row.issueId ?? row.projectName}
                    row={row}
                    days={sheet.days}
                    columns={columns}
                    issues={issues}
                    onCell={onCell}
                    onOpen={openIssue}
                />
            ))}
            <div className={cn(columns, 'border-t border-line px-4 py-2 text-sm font-semibold')}>
                <span>{t('timePage.total')}</span>
                {sheet.days.map((day) => (
                    <span key={day} className="text-center tabular-nums">
                        {sheet.dayTotals[day] ? dates.hours(sheet.dayTotals[day]) : '—'}
                    </span>
                ))}
                <span className="text-right tabular-nums">{dates.hours(sheet.total)}</span>
            </div>
        </Panel>
    )
}

function GridRow({
    row,
    days,
    columns,
    issues,
    onCell,
    onOpen
}: {
    row: TimesheetRow
    days: LocalDate[]
    columns: string
    issues: Record<number, Issue>
    onCell: (issueId: number, spentOn: LocalDate) => void
    onOpen: (issueId: number) => void
}) {
    const { t, dates } = useI18n()
    const issueId = row.issueId
    const label = issueId ? issueLabel(issueId, issues) : t('timePage.noIssue', { project: row.projectName })
    return (
        <div className={cn(columns, 'border-t border-line px-4 py-1.5 text-sm')}>
            <button
                type="button"
                disabled={!issueId}
                onClick={() => {
                    if (issueId) onOpen(issueId)
                }}
                className="min-w-0 cursor-default truncate pr-3 text-left enabled:hover:underline"
                title={label}
            >
                {label}
            </button>
            {days.map((day) => {
                const hours = row.hoursByDay[day]
                return (
                    <button
                        key={day}
                        type="button"
                        disabled={!issueId}
                        onClick={() => {
                            if (issueId) onCell(issueId, day)
                        }}
                        title={t('timePage.cellHint')}
                        className={cn(
                            'mx-1 h-8 cursor-default rounded-md text-center tabular-nums enabled:hover:bg-panel-2',
                            hours ? 'font-semibold' : 'text-muted/60'
                        )}
                    >
                        {hours ? dates.hours(hours) : '+'}
                    </button>
                )
            })}
            <span className="text-right font-semibold tabular-nums">{dates.hours(row.total)}</span>
        </div>
    )
}

function WeekEntries({
    entries,
    issues,
    onEdit
}: {
    entries: TimeEntry[]
    issues: Record<number, Issue>
    onEdit: (entry: TimeEntry) => void
}) {
    const { t } = useI18n()
    return (
        <Panel title={t('timePage.entries')} count={entries.length}>
            <ul>
                {entries.map((entry) => (
                    <TimeEntryRow
                        key={entry.id}
                        issueId={entry.issue?.id}
                        entry={entry}
                        issueLabel={issueLabel(entry.issue?.id, issues)}
                        onEdit={() => onEdit(entry)}
                    />
                ))}
            </ul>
        </Panel>
    )
}

/** Logs again, one week later, every entry of the week before the one shown. */
function RepeatWeekButton({ weekStart }: { weekStart: LocalDate }) {
    const { t, error, dates } = useI18n()
    const toast = useToast()
    const repeat = useRepeatWeek()
    const previousStart = toLocalDate(addDays(parseLocal(weekStart), -7))
    const previousEnd = toLocalDate(addDays(parseLocal(weekStart), -1))
    const previous = useMyTime(previousStart, previousEnd)
    const count = previous.data?.entries.filter((entry) => entry.issue).length ?? 0

    const run = () => {
        const question = t('timePage.repeatConfirm', {
            count,
            from: dates.date(previousStart),
            to: dates.date(previousEnd)
        })
        if (!confirm(question)) return
        repeat.mutate(
            { from: previousStart, to: previousEnd },
            {
                onSuccess: (created) => toast(t('timePage.repeated', { count: created })),
                onError: (repeatError) => toast(error(repeatError), 'error')
            }
        )
    }
    return (
        <Button onClick={run} disabled={!count || repeat.isPending} title={t('timePage.repeatHint')}>
            <Copy size={14} /> {t('timePage.repeat')}
        </Button>
    )
}
