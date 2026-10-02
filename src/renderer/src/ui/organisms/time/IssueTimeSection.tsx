import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { IssueDetail } from '@domain/redmine/entities'
import type { TimeEntry } from '@domain/time/time-entry'
import { useSettings } from '@/hooks/session'
import { useDeleteTime, useIssueTime } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Avatar } from '../../atoms/Avatar'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { useToast } from '../../molecules/Toast'
import { TimeEntryDialog } from './TimeEntryDialog'

type Editing = { entry?: TimeEntry } | null

/** Time logged on the issue: total against the estimate, every entry, and edit/delete for one's own. */
export function IssueTimeSection({ issue }: { issue: IssueDetail }) {
    const { t, dates } = useI18n()
    const entries = useIssueTime(issue.id).data ?? []
    const [editing, setEditing] = useState<Editing>(null)
    const spent = issue.spent_hours ?? entries.reduce((sum, entry) => sum + entry.hours, 0)
    const estimate = issue.estimated_hours
    const totals = estimate
        ? t('time.spentOfEstimate', { spent: dates.hours(spent), estimate: dates.hours(estimate) })
        : t('time.spentOnly', { spent: dates.hours(spent) })

    return (
        <section>
            <div className="mb-3 flex items-center gap-2">
                <span className="text-sm text-muted">{totals}</span>
                <Button variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => setEditing({})}>
                    <Plus size={13} /> {t('time.log')}
                </Button>
            </div>
            {entries.length > 0 && (
                <ul className="overflow-hidden rounded-lg border border-line">
                    {entries.map((entry) => (
                        <TimeEntryRow
                            key={entry.id}
                            issueId={issue.id}
                            entry={entry}
                            onEdit={() => setEditing({ entry })}
                        />
                    ))}
                </ul>
            )}
            {editing && (
                <TimeEntryDialog
                    issue={{ id: issue.id, subject: issue.subject }}
                    entryId={editing.entry?.id}
                    initial={
                        editing.entry && {
                            spentOn: editing.entry.spent_on,
                            hours: editing.entry.hours,
                            activityId: editing.entry.activity.id,
                            comments: editing.entry.comments
                        }
                    }
                    onClose={() => setEditing(null)}
                />
            )}
        </section>
    )
}

/** One entry; `issueLabel` shows which issue it belongs to (lists that mix issues). */
export function TimeEntryRow({
    issueId,
    entry,
    issueLabel,
    onEdit
}: {
    issueId?: number
    entry: TimeEntry
    issueLabel?: string
    onEdit: () => void
}) {
    const { t, dates, error } = useI18n()
    const toast = useToast()
    const me = useSettings().user
    const remove = useDeleteTime()
    const mine = entry.user.id === me?.id

    const confirmRemove = () => {
        if (!confirm(t('time.confirmDelete', { hours: dates.hours(entry.hours), date: dates.date(entry.spent_on) })))
            return
        remove.mutate(
            { id: entry.id, issueId },
            {
                onSuccess: () => toast(t('time.deleted')),
                onError: (deleteError) => toast(error(deleteError), 'error')
            }
        )
    }

    return (
        <li
            className={cn(
                'flex items-center gap-3 border-t border-line px-3 py-2 text-sm first:border-t-0',
                mine && 'bg-accent-soft/40'
            )}
        >
            <span className="w-14 shrink-0 tabular-nums text-muted">{dates.date(entry.spent_on)}</span>
            <Avatar name={entry.user.name} />
            <span className="w-14 shrink-0 font-semibold tabular-nums">{dates.hours(entry.hours)}</span>
            <span className="w-28 shrink-0 truncate rounded bg-panel-2 px-1.5 text-center text-2xs text-muted">
                {entry.activity.name}
            </span>
            {issueLabel && (
                <span className="w-56 shrink-0 truncate text-fg/85" title={issueLabel}>
                    {issueLabel}
                </span>
            )}
            <span className="min-w-0 flex-1 truncate" title={entry.comments}>
                {entry.comments || <span className="italic text-muted">{t('time.noComment')}</span>}
            </span>
            {mine && (
                <span className="flex shrink-0 gap-1">
                    <IconButton size="sm" label={t('common.edit')} icon={<Pencil size={13} />} onClick={onEdit} />
                    <IconButton
                        size="sm"
                        tone="danger"
                        label={t('common.delete')}
                        icon={<Trash2 size={13} />}
                        disabled={remove.isPending}
                        onClick={confirmRemove}
                    />
                </span>
            )}
        </li>
    )
}
