import { type FormEvent, useState } from 'react'
import { Landmark, Plus, Timer, Trash2, Wallet } from 'lucide-react'
import { parseIssueSearch } from '@domain/redmine/issue-search'
import { toLocalDate } from '@domain/shared/date'
import { parseHours } from '@domain/time/time-entry'
import {
    bankBalance,
    EMPTY_BANK,
    hoursInMonth,
    lastTwelveMonths,
    monthOf,
    overtimeMonths,
    paidHoursInYear,
    type OvertimeBank,
    type OvertimeMonth
} from '@domain/time/overtime'
import { useAddOvertime, useOvertime, useRemoveOvertime, useSetMonthPaid } from '@/hooks/overtime'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/atoms/Button'
import { Input } from '@/ui/atoms/fields'
import { IconButton } from '@/ui/atoms/IconButton'
import { Dialog } from '@/ui/molecules/Dialog'
import { Field } from '@/ui/molecules/Field'
import { SegmentedControl } from '@/ui/molecules/SegmentedControl'
import { EmptyRow, Panel, StatTile } from '@/ui/molecules/surfaces'
import { useToast } from '@/ui/molecules/Toast'
import { useOpenIssue } from '@/ui/organisms/IssueModal'
import { PageLayout } from '@/ui/templates/layouts'

/** Month name for "2026-10" in the current language ("out. 2026"). */
function useMonthLabel() {
    const { locale } = useI18n()
    return (month: string, style: 'short' | 'long' = 'short') => {
        const [year, monthNumber] = month.split('-').map(Number)
        const date = new Date(year, monthNumber - 1, 1)
        const label = date.toLocaleDateString(locale, { month: style, year: 'numeric' })
        return label.charAt(0).toUpperCase() + label.slice(1)
    }
}

/** Overtime kept in the app: the bank balance, months kept or paid out, and each entry. */
export default function OvertimePage() {
    const { t } = useI18n()
    const bank = useOvertime().data ?? EMPTY_BANK
    const currentMonth = monthOf(toLocalDate(new Date()))
    const [selectedMonth, setSelectedMonth] = useState(currentMonth)
    const [adding, setAdding] = useState(false)
    const actions = (
        <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={14} /> {t('overtime.add')}
        </Button>
    )
    return (
        <PageLayout title={t('nav.overtime')} actions={actions} width="xl">
            <p className="-mt-2 text-sm text-muted">{t('overtime.intro')}</p>
            <OvertimeStats bank={bank} currentMonth={currentMonth} />
            <MonthChart bank={bank} currentMonth={currentMonth} onPick={setSelectedMonth} />
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
                <MonthList bank={bank} selected={selectedMonth} onPick={setSelectedMonth} />
                <MonthEntries bank={bank} month={selectedMonth} />
            </div>
            {adding && <OvertimeDialog onClose={() => setAdding(false)} />}
        </PageLayout>
    )
}

function OvertimeStats({ bank, currentMonth }: { bank: OvertimeBank; currentMonth: string }) {
    const { t, dates } = useI18n()
    const year = Number(currentMonth.slice(0, 4))
    return (
        <div className="grid grid-cols-3 gap-3">
            <StatTile
                label={t('overtime.thisMonth')}
                value={dates.hours(hoursInMonth(bank, currentMonth))}
                icon={<Timer size={14} />}
            />
            <StatTile
                label={t('overtime.balance')}
                value={dates.hours(bankBalance(bank))}
                icon={<Landmark size={14} />}
            />
            <StatTile
                label={t('overtime.paidInYear', { year })}
                value={dates.hours(paidHoursInYear(bank, year))}
                icon={<Wallet size={14} />}
            />
        </div>
    )
}

const CHART_HEIGHT_PX = 96

function MonthChart({
    bank,
    currentMonth,
    onPick
}: {
    bank: OvertimeBank
    currentMonth: string
    onPick: (month: string) => void
}) {
    const { t, dates } = useI18n()
    const monthLabel = useMonthLabel()
    const months = lastTwelveMonths(bank, currentMonth)
    const highest = Math.max(1, ...months.map((month) => month.hours))
    return (
        <Panel title={t('overtime.chart')} hint={t('overtime.chartHint')}>
            <div className="flex items-end gap-2 px-4 pb-3">
                {months.map((month) => (
                    <button
                        key={month.month}
                        onClick={() => onPick(month.month)}
                        title={`${monthLabel(month.month, 'long')}: ${dates.hours(month.hours)}`}
                        className="flex flex-1 cursor-default flex-col items-center gap-1"
                    >
                        <div className="flex w-full items-end" style={{ height: CHART_HEIGHT_PX }}>
                            <div
                                className={cn('w-full rounded-t', month.paid ? 'bg-muted/40' : 'bg-accent/70')}
                                style={{ height: `${(month.hours / highest) * 100}%` }}
                            />
                        </div>
                        <span className="text-2xs text-muted">{monthLabel(month.month)}</span>
                    </button>
                ))}
            </div>
        </Panel>
    )
}

function MonthList({
    bank,
    selected,
    onPick
}: {
    bank: OvertimeBank
    selected: string
    onPick: (month: string) => void
}) {
    const { t } = useI18n()
    const months = [...overtimeMonths(bank)].reverse()
    return (
        <Panel title={t('overtime.months')}>
            {months.length === 0 && <EmptyRow>{t('overtime.empty')}</EmptyRow>}
            {months.map((month) => (
                <MonthRow key={month.month} month={month} selected={month.month === selected} onPick={onPick} />
            ))}
        </Panel>
    )
}

function MonthRow({
    month,
    selected,
    onPick
}: {
    month: OvertimeMonth
    selected: boolean
    onPick: (month: string) => void
}) {
    const { t, dates, error } = useI18n()
    const toast = useToast()
    const monthLabel = useMonthLabel()
    const setPaid = useSetMonthPaid()
    const change = (paid: boolean) =>
        setPaid.mutate({ month: month.month, paid }, { onError: (saveError) => toast(error(saveError), 'error') })
    return (
        <div
            onClick={() => onPick(month.month)}
            className={cn('flex items-center gap-3 border-t border-line px-4 py-2 text-sm', selected && 'bg-panel-2')}
        >
            <div className="min-w-0 flex-1">
                <div className="font-medium">{monthLabel(month.month, 'long')}</div>
                <div className="text-xs text-muted">
                    {t('overtime.bankAtEnd', { hours: dates.hours(month.bankAtEnd) })}
                </div>
            </div>
            <span className="tabular-nums">{dates.hours(month.hours)}</span>
            <span onClick={(event) => event.stopPropagation()}>
                <SegmentedControl
                    value={month.paid ? 'paid' : 'bank'}
                    options={[
                        { value: 'bank', label: t('overtime.keep') },
                        { value: 'paid', label: t('overtime.paid') }
                    ]}
                    onChange={(value) => change(value === 'paid')}
                />
            </span>
        </div>
    )
}

function MonthEntries({ bank, month }: { bank: OvertimeBank; month: string }) {
    const { t, dates, error } = useI18n()
    const toast = useToast()
    const monthLabel = useMonthLabel()
    const openIssue = useOpenIssue()
    const remove = useRemoveOvertime()
    const entries = bank.entries
        .filter((entry) => monthOf(entry.day) === month)
        .sort((first, second) => second.day.localeCompare(first.day))
    const confirmRemove = (id: string) => {
        if (!confirm(t('overtime.confirmRemove'))) return
        remove.mutate(id, { onError: (removeError) => toast(error(removeError), 'error') })
    }
    return (
        <Panel title={t('overtime.entriesOf', { month: monthLabel(month, 'long') })} count={entries.length}>
            {entries.length === 0 && <EmptyRow>{t('overtime.noEntries')}</EmptyRow>}
            {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 border-t border-line px-4 py-2 text-sm">
                    <span className="w-14 text-muted">{dates.date(entry.day)}</span>
                    <span className="w-14 font-medium tabular-nums">{dates.hours(entry.hours)}</span>
                    <IssueLink issueId={entry.issueId} onOpen={openIssue} />
                    <span className="min-w-0 flex-1 truncate text-muted">{entry.note}</span>
                    <IconButton
                        label={t('overtime.remove')}
                        icon={<Trash2 size={14} />}
                        size="sm"
                        tone="danger"
                        onClick={() => confirmRemove(entry.id)}
                    />
                </div>
            ))}
        </Panel>
    )
}

function IssueLink({ issueId, onOpen }: { issueId?: number; onOpen: (id: number) => void }) {
    if (!issueId) return <span className="text-muted">—</span>
    return (
        <button className="text-accent hover:underline" onClick={() => onOpen(issueId)}>
            #{issueId}
        </button>
    )
}

/** Overtime without logging time in Redmine (the time entry may already exist, or be logged elsewhere). */
function OvertimeDialog({ onClose }: { onClose: () => void }) {
    const { t, error } = useI18n()
    const toast = useToast()
    const add = useAddOvertime()
    const [day, setDay] = useState(toLocalDate(new Date()))
    const [typedHours, setTypedHours] = useState('')
    const [typedIssue, setTypedIssue] = useState('')
    const [note, setNote] = useState('')
    const hours = parseHours(typedHours)
    const reference = parseIssueSearch(typedIssue)
    const issueId = reference.type === 'id' ? reference.id : undefined
    const issueValid = !typedIssue.trim() || issueId !== undefined
    const canSave = hours !== null && hours > 0 && issueValid && !add.isPending

    const submit = (event: FormEvent) => {
        event.preventDefault()
        if (!canSave || hours === null) return
        add.mutate(
            { day, hours, issueId, note },
            { onSuccess: onClose, onError: (saveError) => toast(error(saveError), 'error') }
        )
    }

    return (
        <Dialog title={t('overtime.add')} onClose={onClose}>
            <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                    <Field label={t('time.date')}>
                        <Input type="date" required value={day} onChange={(event) => setDay(event.target.value)} />
                    </Field>
                    <Field label={t('time.hours')} hint={t('time.hoursHint')}>
                        <Input
                            autoFocus
                            inputMode="decimal"
                            placeholder="1,5"
                            value={typedHours}
                            onChange={(event) => setTypedHours(event.target.value)}
                        />
                    </Field>
                    <Field label={t('overtime.issue')} hint={issueValid ? undefined : t('issue.edit.invalidParent')}>
                        <Input
                            placeholder="#1234"
                            value={typedIssue}
                            onChange={(event) => setTypedIssue(event.target.value)}
                        />
                    </Field>
                </div>
                <Field label={t('overtime.note')}>
                    <Input value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button variant="primary" type="submit" disabled={!canSave}>
                        {t('overtime.save')}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
