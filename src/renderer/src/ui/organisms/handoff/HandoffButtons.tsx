import { useState } from 'react'
import { MessageSquarePlus, Send } from 'lucide-react'
import { NEW_TRAMITE_RULE, rulesFor, type HandoffRule } from '@domain/automation/handoff'
import type { IssueDetail, Journal } from '@domain/redmine/entities'
import { useSettings } from '@/hooks/session'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { HandoffDialog } from './HandoffDialog'
import { TramiteDialog } from './TramiteDialog'

const ACTION_BUTTON =
    'inline-flex h-7 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-xs disabled:opacity-50'

/** The rules whose button shows on this issue, split by kind. */
function useIssueRules(issue: IssueDetail) {
    const rules = rulesFor(useSettings().handoffRules, issue)
    return { same: rules.filter((rule) => rule.mode === 'same'), other: rules.filter((rule) => rule.mode === 'other') }
}

type Opened = { rule: HandoffRule; journalId?: number } | undefined

function OpenedDialog({
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

/** "Novo trâmite" (always) and the configured handoff buttons that apply to this issue's tracker and status. */
export function HandoffButtons({ issue }: { issue: IssueDetail }) {
    const { t } = useI18n()
    const rules = useIssueRules(issue)
    const [opened, setOpened] = useState<Opened>()
    const configured = [...rules.same, ...rules.other]
    return (
        <>
            <button
                type="button"
                onClick={() => setOpened({ rule: NEW_TRAMITE_RULE })}
                title={t('handoff.newTramiteHint')}
                className={cn(ACTION_BUTTON, 'border-line text-fg/85 hover:bg-panel-2 hover:text-fg')}
            >
                <MessageSquarePlus size={13} />
                {t('handoff.newTramite')}
            </button>
            {configured.map((rule) => (
                <button
                    key={rule.id}
                    type="button"
                    onClick={() => setOpened({ rule })}
                    className={cn(ACTION_BUTTON, 'border-accent/40 bg-accent-soft text-accent hover:border-accent')}
                >
                    <Send size={13} />
                    {rule.name}
                </button>
            ))}
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
