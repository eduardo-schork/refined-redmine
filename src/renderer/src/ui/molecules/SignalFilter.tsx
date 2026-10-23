import { AlarmClock, ChevronsUp, Pause, UserX, X, type LucideIcon } from 'lucide-react'
import { ISSUE_SIGNALS, type IssueSignal } from '@domain/redmine/issue-signals'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const SIGNAL_STYLES: Record<IssueSignal, { icon: LucideIcon; tone: string }> = {
    overdue: { icon: AlarmClock, tone: 'text-due-overdue' },
    highPriority: { icon: ChevronsUp, tone: 'text-pr-high' },
    stale: { icon: Pause, tone: 'text-warn' },
    unassigned: { icon: UserX, tone: 'text-fg/80' }
}

/** Counters of what needs attention; clicking one shows only those issues. Counters at zero are hidden. */
export function SignalFilter({
    counts,
    active,
    onChange
}: {
    counts: Record<IssueSignal, number>
    active: IssueSignal | null
    onChange: (signal: IssueSignal | null) => void
}) {
    const { t } = useI18n()
    const shown = ISSUE_SIGNALS.filter((signal) => counts[signal] > 0 || signal === active)
    if (!shown.length) return null
    return (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            {shown.map((signal) => {
                const { icon: Icon, tone } = SIGNAL_STYLES[signal]
                const selected = signal === active
                return (
                    <button
                        key={signal}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(selected ? null : signal)}
                        className={cn(
                            'inline-flex h-8 cursor-default items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors',
                            selected ? 'border-accent bg-accent-soft' : 'border-line bg-panel hover:bg-panel-2'
                        )}
                    >
                        <Icon size={14} className={tone} />
                        <span className="font-semibold tabular-nums">{counts[signal]}</span>
                        {t(`board.signals.${signal}`, { count: counts[signal] })}
                        {selected && <X size={13} className="text-muted" />}
                    </button>
                )
            })}
        </div>
    )
}
