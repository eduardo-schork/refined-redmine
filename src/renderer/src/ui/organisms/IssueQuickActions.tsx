import { Code2, Hash, Heading, Link2, MessageSquareText, UserCheck, type LucideIcon } from 'lucide-react'
import type { IssueDetail } from '@domain/redmine/entities'
import { COPY_FORMATS, copyText, type CopyFormat } from '@domain/redmine/issue-copy'
import { useEditIssue } from '@/hooks/issues'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useToast } from '../molecules/Toast'

const ICONS: Record<CopyFormat, LucideIcon> = {
    link: Link2,
    number: Hash,
    title: Heading,
    reference: MessageSquareText,
    markdown: Code2
}

const ACTION_BUTTON =
    'inline-flex h-7 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-xs disabled:opacity-50'

/** Takes the issue for the signed-in user. Hidden when the issue is already theirs. */
function AssignToMeButton({ issue }: { issue: IssueDetail }) {
    const { t, error } = useI18n()
    const toast = useToast()
    const me = useSettings().user
    const edit = useEditIssue(issue.id)
    const alreadyMine = issue.assigned_to?.id === me?.id
    if (!me || alreadyMine) return null

    const assign = () => {
        edit.mutate(
            { assignedToId: me.id },
            {
                onSuccess: (result) => {
                    const applied = !result.ignored.includes('assignedToId')
                    if (applied) toast(t('issue.assignToMe.done', { id: issue.id }))
                    else toast(t('issue.assignToMe.ignored'), 'error')
                },
                onError: (assignError) => toast(error(assignError), 'error')
            }
        )
    }

    return (
        <button
            type="button"
            disabled={edit.isPending}
            onClick={assign}
            title={t('issue.assignToMe.hint')}
            className={cn(ACTION_BUTTON, 'border-accent/40 bg-accent-soft font-medium text-accent hover:border-accent')}
        >
            <UserCheck size={13} />
            {edit.isPending ? t('issue.assignToMe.saving') : t('issue.assignToMe.label')}
        </button>
    )
}

/**
 * Quick actions of the issue detail: take the issue, and copy its link, number, title, "#number title" or a
 * Markdown link.
 */
export function IssueQuickActions({ issue, url }: { issue: IssueDetail; url: string }) {
    const { t } = useI18n()
    const toast = useToast()

    async function copy(format: CopyFormat) {
        const text = copyText(format, issue, url)
        try {
            await navigator.clipboard.writeText(text)
            toast(t('issue.copy.copied', { text }))
        } catch {
            toast(t('issue.copy.failed'), 'error')
        }
    }

    return (
        <div className="mt-2 flex flex-wrap items-center gap-1" role="toolbar" aria-label={t('issue.copy.label')}>
            <AssignToMeButton issue={issue} />
            {COPY_FORMATS.map((format) => {
                const Icon = ICONS[format]
                return (
                    <button
                        key={format}
                        type="button"
                        title={t(`issue.copy.${format}Hint`)}
                        onClick={() => void copy(format)}
                        className={cn(ACTION_BUTTON, 'border-line text-fg/85 hover:bg-panel-2 hover:text-fg')}
                    >
                        <Icon size={13} />
                        {t(`issue.copy.${format}`)}
                    </button>
                )
            })}
        </div>
    )
}
