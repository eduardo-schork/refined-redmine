import { useState } from 'react'
import { Terminal } from 'lucide-react'
import { claudeActionsFor, type ClaudeAction } from '@domain/automation/claude-action'
import type { Issue } from '@domain/redmine/entities'
import { useCommentAndChange } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { useSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { ActionIcon } from '../atoms/ActionIcon'
import { useToast } from '../molecules/Toast'

/**
 * The Claude actions that apply to the issue, and how to run one: with a status configured it asks first
 * ("Status: A → B"), opens Claude and only then changes the status.
 */
export function useClaudeActions(issue: Pick<Issue, 'id' | 'subject' | 'tracker' | 'status'>) {
    const { t, error } = useI18n()
    const toast = useToast()
    const actions = claudeActionsFor(useSettings().claudeActions, issue)
    const statuses = useStatuses().data ?? []
    const commentAndChange = useCommentAndChange()
    const [running, setRunning] = useState(false)

    const openAndChange = async (action: ClaudeAction) => {
        const target = statuses.find((status) => status.id === action.statusId)
        const changesStatus = target && target.id !== issue.status.id
        const question = { id: issue.id, from: issue.status.name, to: target?.name }
        if (changesStatus && !confirm(t('claude.confirmStatus', question))) return
        setRunning(true)
        try {
            await api.claude.open(action.id, { id: issue.id, subject: issue.subject })
        } catch (openError) {
            toast(error(openError), 'error')
            return
        }
        toast(t('claude.opened', { id: issue.id }))
        if (!changesStatus) return
        try {
            const result = await commentAndChange.mutateAsync({
                id: issue.id,
                change: { statusId: target.id },
                uploads: []
            })
            if (result.outcome === 'partial') toast(t('claude.statusIgnored', { id: issue.id }), 'error')
        } catch (changeError) {
            toast(error(changeError), 'error')
        }
    }
    const run = async (action: ClaudeAction) => {
        try {
            await openAndChange(action)
        } finally {
            setRunning(false)
        }
    }
    return { actions, run, running }
}

const ACTION_BUTTON =
    'inline-flex h-7 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-xs disabled:opacity-50'

/** Buttons of the Claude actions in the issue detail, next to the trâmites. */
export function ClaudeActionButtons({ issue }: { issue: Issue }) {
    const { actions, run } = useClaudeActions(issue)
    return actions.map((action) => (
        <button
            key={action.id}
            type="button"
            onClick={() => void run(action)}
            className={cn(ACTION_BUTTON, 'border-line text-fg/85 hover:bg-panel-2 hover:text-fg')}
        >
            <ActionIcon name={action.icon} fallback={Terminal} size={13} />
            {action.name}
        </button>
    ))
}
