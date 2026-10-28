import { useState, type ReactNode } from 'react'
import { MessageSquarePlus, Send } from 'lucide-react'
import { NEW_TRAMITE_RULE, rulesFor, type HandoffRule } from '@domain/automation/handoff'
import type { IssueDetail, Journal } from '@domain/redmine/entities'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { ActionButton } from '../../atoms/ActionButton'
import { ActionIcon } from '../../atoms/ActionIcon'
import { HandoffDialog } from './HandoffDialog'
import { TramiteDialog } from './TramiteDialog'

/** The rules whose button shows on this issue, split by kind. */
export function useIssueRules(issue: Pick<IssueDetail, 'tracker' | 'status'>) {
    const rules = rulesFor(useSettings().handoffRules, issue)
    return { same: rules.filter((rule) => rule.mode === 'same'), other: rules.filter((rule) => rule.mode === 'other') }
}

export type Opened = { rule: HandoffRule; journalId?: number } | undefined

export function OpenedDialog({
    issue,
    opened,
    others,
    onClose
}: {
    issue: IssueDetail
    opened: Opened
    others: HandoffRule[]
    onClose: () => void
}) {
    if (!opened) return null
    if (opened.rule.mode === 'same') return <TramiteDialog issue={issue} rule={opened.rule} onClose={onClose} />
    return (
        <HandoffDialog
            source={issue}
            rules={others}
            initialRuleId={opened.rule.id}
            initialJournalId={opened.journalId}
            onClose={onClose}
        />
    )
}

/**
 * The configured handoff buttons that apply to this issue's tracker and status, then `otherActions` (the Claude
 * actions) and "Novo trâmite" (always) last: the automations are what is used most.
 */
export function HandoffButtons({ issue, otherActions }: { issue: IssueDetail; otherActions?: ReactNode }) {
    const { t } = useI18n()
    const rules = useIssueRules(issue)
    const [opened, setOpened] = useState<Opened>()
    const configured = [...rules.same, ...rules.other]
    return (
        <>
            {configured.map((rule) => (
                <ActionButton key={rule.id} tone="accent" onClick={() => setOpened({ rule })}>
                    <ActionIcon name={rule.icon} fallback={Send} />
                    {rule.name}
                </ActionButton>
            ))}
            {otherActions}
            <ActionButton onClick={() => setOpened({ rule: NEW_TRAMITE_RULE })} title={t('handoff.newTramiteHint')}>
                <MessageSquarePlus />
                {t('handoff.newTramite')}
            </ActionButton>
            <OpenedDialog issue={issue} opened={opened} others={rules.other} onClose={() => setOpened(undefined)} />
        </>
    )
}

/** On each note of the history: send it to a nearby issue with the first handoff rule that applies. */
export function SendNoteButton({ issue, journal }: { issue: IssueDetail; journal: Journal }) {
    const { t } = useI18n()
    const rules = useIssueRules(issue)
    const [opened, setOpened] = useState<Opened>()
    if (!rules.other.length || !journal.notes?.trim()) return null
    return (
        <>
            <button
                type="button"
                title={t('handoff.sendNote')}
                aria-label={t('handoff.sendNote')}
                onClick={() => setOpened({ rule: rules.other[0], journalId: journal.id })}
                className="ml-1 inline-flex rounded p-0.5 align-middle text-muted hover:bg-panel-2 hover:text-fg"
            >
                <Send size={12} />
            </button>
            <OpenedDialog issue={issue} opened={opened} others={rules.other} onClose={() => setOpened(undefined)} />
        </>
    )
}
