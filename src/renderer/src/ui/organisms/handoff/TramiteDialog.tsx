import { useState } from 'react'
import { fillTemplate, type HandoffRule } from '@domain/automation/handoff'
import type { IssueDetail } from '@domain/redmine/entities'
import { toggleSubtree } from '@domain/redmine/issue-tree'
import { useCommentAndChange, useIssueTree } from '@/hooks/issues'
import { useI18n } from '@/lib/i18n'
import { stepProblems, useSteps, type Step } from '@/lib/steps'
import { Dialog } from '../../molecules/Dialog'
import { StepIcon } from '../../molecules/StepIcon'
import { StepProblems } from '../../molecules/StepProblems'
import { StepsFooter } from '../../molecules/StepsFooter'
import { useToast } from '../../molecules/Toast'
import { ChoiceFields, choiceKeyOf, KEEP, nothingChosen, toChange, TreeTable, type Choices } from '../BulkEditDialog'
import { useChosenFiles } from '../IssueCreateDialog'
import { CommentWithFiles, HoursFields, useHandoffHours, useTimeSteps } from './HandoffParts'

export const initialChoices = (rule: HandoffRule): Choices => ({
    status: rule.statusId ? String(rule.statusId) : KEEP,
    assignee: rule.assigneeId ? String(rule.assigneeId) : KEEP,
    version: KEEP
})

/** Linked issues checked to receive the same comment and changes (the issue itself always does). */
function useExtraIssues(issue: IssueDetail, enabled: boolean) {
    const tree = useIssueTree(issue.id, enabled)
    const nodes = enabled ? (tree.data ?? []).filter((node) => node.issue.id !== issue.id) : []
    const [checked, setChecked] = useState(new Set<number>())
    return { nodes, checked, toggle: (id: number) => setChecked(toggleSubtree(nodes, checked, id)) }
}

/**
 * "Novo trâmite" and the rules that act on the issue itself: a comment (with files), status, assignee and version
 * in one update, optionally repeated on checked linked issues, and the hours. Sent as steps that a retry does not
 * repeat once done.
 */
export function TramiteDialog({
    issue,
    rule,
    onClose
}: {
    issue: IssueDetail
    rule: HandoffRule
    onClose: () => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const template = { id: issue.id, subject: issue.subject, trackerName: issue.tracker.name }
    const [comment, setComment] = useState(() => fillTemplate(rule.template, template))
    const [choices, setChoices] = useState(() => initialChoices(rule))
    const files = useChosenFiles()
    const hours = useHandoffHours(rule, issue)
    const extras = useExtraIssues(issue, rule.bulk)
    const commentAndChange = useCommentAndChange()
    const steps = useSteps(error)

    const change = { ...toChange(choices), notes: comment }
    const contentKey = `${choiceKeyOf(choices)}:${comment.length}:${files.uploads.length}`
    const updateStep = (id: number): Step => ({
        key: `update:${id}:${contentKey}`,
        run: async () => {
            const result = await commentAndChange.mutateAsync({ id, change, uploads: files.uploads })
            if (result.outcome === 'partial') return t('bulk.ignored', { fields: ignoredNames(result.ignored, t) })
        }
    })
    const timeSteps = useTimeSteps(hours, issue.id, comment)
    const planned = [updateStep(issue.id), ...[...extras.checked].map(updateStep), ...timeSteps]
    const hasSomething =
        Boolean(comment.trim()) || files.uploads.length > 0 || !nothingChosen(choices) || timeSteps.length > 0

    const send = async () => {
        const clean = await steps.run(planned)
        if (!clean) return
        toast(t('handoff.sent', { id: issue.id }))
        onClose()
    }

    const footer = (
        <StepsFooter
            planned={planned}
            outcomes={steps.outcomes}
            pending={steps.pending(planned).length}
            running={steps.running}
            ready={hasSomething && !hours.blocked}
            startLabel={t('handoff.send')}
            onStart={() => void send()}
            onClose={onClose}
        />
    )

    const title = rule.name || t('handoff.newTramite')
    return (
        <Dialog title={`${title} · #${issue.id}`} onClose={onClose} size="xl" footer={footer}>
            <div className="flex flex-col gap-4">
                <ChoiceFields projectId={issue.project.id} choices={choices} onChange={setChoices} />
                <CommentWithFiles
                    comment={comment}
                    onComment={setComment}
                    files={files}
                    attachments={issue.attachments}
                    placeholder={t('handoff.placeholder')}
                />
                <HoursFields hours={hours} />
                {extras.nodes.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted">{t('handoff.alsoOn')}</span>
                        <TreeTable
                            nodes={extras.nodes}
                            checked={extras.checked}
                            outcomes={{}}
                            choiceKey=""
                            onToggle={extras.toggle}
                        />
                    </div>
                )}
                <StepList planned={planned} outcomes={steps.outcomes} labelOf={(key) => stepLabel(key, t)} />
            </div>
        </Dialog>
    )
}

export function ignoredNames(fields: string[], t: ReturnType<typeof useI18n>['t']): string {
    return fields.map((field) => t(`bulk.fields.${field}` as 'bulk.fields.statusId')).join(', ')
}

/** "update:1201:…" → "Trâmite em #1201", "time:1201:…" → "Horas em #1201"… */
export function stepLabel(key: string, t: ReturnType<typeof useI18n>['t']): string {
    const [kind, id] = key.split(':')
    return t(`handoff.steps.${kind}` as 'handoff.steps.update', { id })
}

/** What ran and how it went, once sending started. */
export function StepList({
    planned,
    outcomes,
    labelOf
}: {
    planned: Step[]
    outcomes: ReturnType<typeof useSteps>['outcomes']
    labelOf: (key: string) => string
}) {
    const started = planned.filter((step) => outcomes[step.key])
    if (!started.length) return null
    return (
        <>
            <ul className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2 text-sm">
                {started.map((step) => (
                    <li key={step.key} className="flex items-center gap-2">
                        <StepIcon outcome={outcomes[step.key]} />
                        <span>{labelOf(step.key)}</span>
                    </li>
                ))}
            </ul>
            <StepProblems problems={stepProblems(planned, outcomes, labelOf)} />
        </>
    )
}
