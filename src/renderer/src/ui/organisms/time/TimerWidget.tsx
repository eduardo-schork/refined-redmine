import { useState } from 'react'
import { Pause, Play, Square, X } from 'lucide-react'
import { elapsedMs, formatStopwatch, isRunning, type StoppedTimer, type TimerState } from '@domain/time/timer'
import { useTimer, useTimerActions } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/cn'
import { IconButton } from '../../atoms/IconButton'
import { useOpenIssue } from '../IssueModal'
import { TimeEntryDialog } from './TimeEntryDialog'

function PauseNote({ timer }: { timer: TimerState }) {
    const { t, dates } = useI18n()
    if (!timer.pausedReason || timer.pausedReason === 'manual') return null
    const since = timer.pausedAt ? dates.time(new Date(timer.pausedAt)) : ''
    return <p className="mt-1 text-2xs text-warn">{t(`timer.paused.${timer.pausedReason}`, { since })}</p>
}

/** The stopwatch in the sidebar: issue, running time, pause/resume, stop (then log) and discard. */
export function TimerWidget() {
    const { t } = useI18n()
    const timer = useTimer().data
    const actions = useTimerActions()
    const openIssue = useOpenIssue()
    const [stopped, setStopped] = useState<StoppedTimer | null>(null)
    const running = Boolean(timer && isRunning(timer))
    const now = useNow(1000, running)
    if (!timer) return null

    const stop = () => actions.stop.mutate(undefined, { onSuccess: (result) => setStopped(result) })
    const discard = () => {
        if (confirm(t('timer.confirmDiscard', { id: timer.issueId }))) actions.discard.mutate()
    }

    return (
        <div className="mx-2 mb-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2">
            <button
                type="button"
                onClick={() => openIssue(timer.issueId)}
                className="block w-full cursor-default truncate text-left text-xs text-fg/85 hover:underline"
                title={timer.issueSubject}
            >
                #{timer.issueId} {timer.issueSubject}
            </button>
            <div className="mt-1 flex items-center gap-1">
                <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', running ? 'animate-pulse bg-danger' : 'bg-muted')}
                />
                <span className="flex-1 font-mono text-lg font-semibold tabular-nums">
                    {formatStopwatch(elapsedMs(timer, now))}
                </span>
                {running ? (
                    <IconButton
                        size="sm"
                        label={t('timer.pause')}
                        icon={<Pause size={14} />}
                        onClick={() => actions.pause.mutate()}
                    />
                ) : (
                    <IconButton
                        size="sm"
                        label={t('timer.resume')}
                        icon={<Play size={14} />}
                        onClick={() => actions.resume.mutate()}
                    />
                )}
                <IconButton size="sm" label={t('timer.stop')} icon={<Square size={13} />} onClick={stop} />
                <IconButton
                    size="sm"
                    tone="danger"
                    label={t('timer.discard')}
                    icon={<X size={14} />}
                    onClick={discard}
                />
            </div>
            <PauseNote timer={timer} />
            {stopped && (
                <TimeEntryDialog
                    issue={{ id: stopped.issueId, subject: stopped.issueSubject }}
                    initial={{ hours: stopped.hours }}
                    onClose={() => setStopped(null)}
                    onSaved={() => actions.discard.mutate()}
                />
            )}
        </div>
    )
}
