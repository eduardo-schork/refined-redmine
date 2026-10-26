import { useState, type SyntheticEvent } from 'react'
import { useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import {
    ArrowLeftRight,
    ExternalLink,
    Layers,
    Loader2,
    Maximize2,
    MessageSquarePlus,
    Send,
    Terminal
} from 'lucide-react'
import { NEW_TRAMITE_RULE, type HandoffRule } from '@domain/automation/handoff'
import type { Issue } from '@domain/redmine/entities'
import { RedmineLinks } from '@domain/redmine/links'
import { issueQuery, useChangeIssueStatus, useIssue } from '@/hooks/issues'
import { useSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { qk } from '@/lib/query-keys'
import { ActionIcon } from '../atoms/ActionIcon'
import { Menu, MenuItem, type MenuEntry } from '../molecules/Menu'
import { StatusToneDot } from '../molecules/StatusTag'
import { useToast } from '../molecules/Toast'
import { BulkEditDialog } from './BulkEditDialog'
import { useClaudeActions } from './ClaudeActions'
import { OpenedDialog, useIssueRules } from './handoff/HandoffButtons'
import { useOpenIssue } from './IssueModal'

type Opened = { kind: 'bulk' } | { kind: 'rule'; rule: HandoffRule }

// Dialogs opened from a card live inside it: their clicks must not reach the card (it opens the issue or drags).
const stopPropagation = (event: SyntheticEvent) => event.stopPropagation()

/**
 * "⋮" of a card or list row: open, change status, bulk edit, trâmites and the automations of this issue. While an
 * action loads or runs, the "⋮" spins; `data-active` keeps it (and the dialog inside it) visible on the card, which
 * otherwise shows it only on hover.
 */
export function IssueActionsMenu({ issue }: { issue: Issue }) {
    const { t, error } = useI18n()
    const toast = useToast()
    const queryClient = useQueryClient()
    const openIssue = useOpenIssue()
    const links = new RedmineLinks(useSettings().baseUrl)
    const rules = useIssueRules(issue)
    const claude = useClaudeActions(issue)
    const changeStatus = useChangeIssueStatus(issue.id)
    const [opened, setOpened] = useState<Opened>()
    const [loading, setLoading] = useState(false)
    const busy = loading || changeStatus.isPending || claude.running

    // The dialogs need the full issue (journals, allowed statuses): it is loaded before they open.
    const openAction = async (action: Opened) => {
        setLoading(true)
        try {
            await queryClient.fetchQuery(issueQuery(issue.id))
            setOpened(action)
        } catch (loadError) {
            toast(error(loadError), 'error')
        } finally {
            setLoading(false)
        }
    }

    const automations: MenuEntry[] = [
        ...[...rules.same, ...rules.other].map((rule) => ({
            label: rule.name,
            icon: <ActionIcon name={rule.icon} fallback={Send} />,
            onSelect: () => void openAction({ kind: 'rule', rule })
        })),
        ...claude.actions.map((action) => ({
            label: action.name,
            icon: <ActionIcon name={action.icon} fallback={Terminal} />,
            onSelect: () => void claude.run(action)
        }))
    ]

    const entries: MenuEntry[] = [
        { label: t('issueMenu.open'), icon: <Maximize2 />, onSelect: () => openIssue(issue.id) },
        'divider',
        {
            label: t('issueMenu.changeStatus'),
            icon: <ArrowLeftRight />,
            submenu: (close) => <StatusChoices issue={issue} changeStatus={changeStatus} onDone={close} />
        },
        { label: t('bulk.button'), icon: <Layers />, onSelect: () => void openAction({ kind: 'bulk' }) },
        'divider',
        ...automations,
        {
            label: t('handoff.newTramite'),
            icon: <MessageSquarePlus />,
            onSelect: () => void openAction({ kind: 'rule', rule: NEW_TRAMITE_RULE })
        },
        'divider',
        {
            label: t('common.openInRedmine'),
            icon: <ExternalLink />,
            onSelect: () => void api.app.openExternal(links.issue(issue.id))
        }
    ]

    return (
        <div
            data-active={busy || opened ? true : undefined}
            aria-busy={busy}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
            onKeyDown={stopPropagation}
        >
            <Menu
                label={t('issueMenu.label')}
                entries={entries}
                icon={busy ? <Loader2 className="animate-spin" /> : undefined}
            />
            {opened && (
                <OpenedAction
                    issueId={issue.id}
                    opened={opened}
                    handoffRules={rules.other}
                    onClose={() => setOpened(undefined)}
                />
            )}
        </div>
    )
}

function OpenedAction({
    issueId,
    opened,
    handoffRules,
    onClose
}: {
    issueId: number
    opened: Opened
    handoffRules: HandoffRule[]
    onClose: () => void
}) {
    const issue = useIssue(issueId, true).data
    if (!issue) return null
    if (opened.kind === 'bulk') return <BulkEditDialog issue={issue} onClose={onClose} />
    return <OpenedDialog issue={issue} opened={{ rule: opened.rule }} others={handoffRules} onClose={onClose} />
}

/**
 * Statuses the Redmine workflow allows from the current one; the current one is checked. The change belongs to the
 * menu (it outlives this list, which closes on choosing).
 */
function StatusChoices({
    issue,
    changeStatus,
    onDone
}: {
    issue: Issue
    changeStatus: UseMutationResult<void, Error, number>
    onDone: () => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const allowed = useQuery({
        queryKey: qk.allowed(issue.id, issue.updated_on),
        queryFn: () => api.issues.allowedStatuses(issue.id),
        staleTime: 60_000
    })

    if (allowed.isLoading) return <p className="px-3 py-2 text-xs text-muted">{t('common.loading')}</p>
    if (allowed.isError) return <p className="px-3 py-2 text-xs text-danger">{error(allowed.error)}</p>

    const choose = (statusId: number, name: string) => {
        onDone()
        if (statusId === issue.status.id) return
        changeStatus.mutate(statusId, {
            onSuccess: () => toast(t('board.moved', { id: issue.id, status: name })),
            onError: (changeError) => toast(t('board.moveFailed', { id: issue.id, error: error(changeError) }), 'error')
        })
    }
    const statuses = allowed.data ?? []
    const withCurrent = statuses.some((status) => status.id === issue.status.id)
        ? statuses
        : [issue.status, ...statuses]
    return withCurrent.map((status) => (
        <MenuItem
            key={status.id}
            label={status.name}
            icon={<StatusToneDot status={status} />}
            checked={status.id === issue.status.id}
            onClick={() => choose(status.id, status.name)}
        />
    ))
}
