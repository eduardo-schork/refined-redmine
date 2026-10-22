import { useState } from 'react'
import type { IssueDetail } from '@domain/redmine/entities'
import { subtreeIds, toggleSubtree, type BulkChange, type IssueTreeNode } from '@domain/redmine/issue-tree'
import { useBulkEdit, useIssueEditOptions, useIssueTree } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { useSteps, type Step, type StepOutcome } from '@/lib/steps'
import { Select } from '../atoms/fields'
import { Dialog } from '../molecules/Dialog'
import { Field } from '../molecules/Field'
import { StepIcon } from '../molecules/StepIcon'
import { StepsFooter } from '../molecules/StepsFooter'
import { Alert } from '../molecules/surfaces'
import { useToast } from '../molecules/Toast'

export const KEEP = 'keep'
const CLEAR = 'none'

/** "keep" → undefined (field untouched), "none" → null (cleared), else the id. */
function choice(value: string): number | null | undefined {
    if (value === KEEP) return undefined
    if (value === CLEAR) return null
    return Number(value)
}

export interface Choices {
    status: string
    assignee: string
    version: string
}

export function toChange(choices: Choices): BulkChange {
    const statusId = choice(choices.status)
    return {
        statusId: statusId ?? undefined,
        assignedToId: choice(choices.assignee),
        fixedVersionId: choice(choices.version)
    }
}

/** Part of each step key: changing a choice after a run applies the new choice again. */
export const choiceKeyOf = (choices: Choices) => `${choices.status}:${choices.assignee}:${choices.version}`

export const nothingChosen = (choices: Choices) => Object.values(choices).every((value) => value === KEEP)

/**
 * Status, assignee and version for the issue, its parent, related issues and subtasks at once (for example a story
 * and its tasks from the backlog to the sprint). Each issue is a step: only what differs is sent, and a retry
 * repeats only what failed.
 */
export function BulkEditDialog({ issue, onClose }: { issue: IssueDetail; onClose: () => void }) {
    const { t, error } = useI18n()
    const toast = useToast()
    const tree = useIssueTree(issue.id)
    const nodes = tree.data ?? []
    const [checked, setChecked] = useState<Set<number>>()
    const selected = checked ?? new Set(tree.data ? subtreeIds(nodes, issue.id) : [])
    const [choices, setChoices] = useState<Choices>({ status: KEEP, assignee: KEEP, version: KEEP })
    const bulkEdit = useBulkEdit()
    const steps = useSteps(error)

    const choiceKey = choiceKeyOf(choices)
    const change = toChange(choices)
    const plannedSteps: Step[] = nodes
        .filter((node) => selected.has(node.issue.id))
        .map((node) => ({
            key: `${node.issue.id}:${choiceKey}`,
            run: async () => {
                const result = await bulkEdit.mutateAsync({ id: node.issue.id, change })
                if (result.outcome !== 'partial') return
                const fields = result.ignored.map((field) => t(`bulk.fields.${field}`)).join(', ')
                return t('bulk.ignored', { fields })
            }
        }))
    const pendingCount = steps.pending(plannedSteps).length

    const apply = async () => {
        const clean = await steps.run(plannedSteps)
        if (!clean) return
        toast(t('bulk.done', { count: plannedSteps.length }))
        onClose()
    }

    const footer = (
        <StepsFooter
            planned={plannedSteps}
            outcomes={steps.outcomes}
            pending={pendingCount}
            running={steps.running}
            ready={!nothingChosen(choices)}
            startLabel={t('bulk.apply', { count: pendingCount })}
            onStart={() => void apply()}
            onClose={onClose}
        />
    )

    return (
        <Dialog title={t('bulk.title', { id: issue.id })} onClose={onClose} size="xl" footer={footer}>
            <div className="flex flex-col gap-4">
                <ChoiceFields projectId={issue.project.id} choices={choices} onChange={setChoices} />
                {tree.isError && <Alert>{error(tree.error)}</Alert>}
                {!tree.data && !tree.isError && <p className="text-sm text-muted">{t('bulk.loading')}</p>}
                <TreeTable
                    nodes={nodes}
                    checked={selected}
                    outcomes={steps.outcomes}
                    choiceKey={choiceKey}
                    onToggle={(id) => setChecked(toggleSubtree(nodes, selected, id))}
                />
            </div>
        </Dialog>
    )
}

/** Status, assignee (members of the project) and version (its open versions), each starting at "keep". */
export function ChoiceFields({
    projectId,
    choices,
    onChange
}: {
    projectId: number
    choices: Choices
    onChange: (choices: Choices) => void
}) {
    const { t } = useI18n()
    const statuses = useStatuses().data ?? []
    const options = useIssueEditOptions(projectId).data
    const update = (patch: Partial<Choices>) => onChange({ ...choices, ...patch })
    return (
        <div className="grid grid-cols-3 gap-4">
            <Field label={t('issue.status')}>
                <Select value={choices.status} onChange={(event) => update({ status: event.target.value })}>
                    <option value={KEEP}>{t('bulk.keep')}</option>
                    {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                            {status.name}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label={t('issue.assignee')}>
                <Select value={choices.assignee} onChange={(event) => update({ assignee: event.target.value })}>
                    <option value={KEEP}>{t('bulk.keep')}</option>
                    <option value={CLEAR}>{t('issue.edit.nobody')}</option>
                    {(options?.assignees ?? []).map((person) => (
                        <option key={person.id} value={person.id}>
                            {person.name}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label={t('issue.version')}>
                <Select value={choices.version} onChange={(event) => update({ version: event.target.value })}>
                    <option value={KEEP}>{t('bulk.keep')}</option>
                    <option value={CLEAR}>{t('issue.edit.noVersion')}</option>
                    {(options?.versions ?? []).map((version) => (
                        <option key={version.id} value={version.id}>
                            {version.name}
                        </option>
                    ))}
                </Select>
            </Field>
        </div>
    )
}

function roleLabel(node: IssueTreeNode, t: ReturnType<typeof useI18n>['t']): string {
    if (node.role === 'related' && node.relation) return t(`issue.relation.${node.relation}`)
    return t(`bulk.roles.${node.role}`)
}

/** The issue tree with a checkbox per issue (checking cascades to subtasks) and each issue's step result. */
export function TreeTable({
    nodes,
    checked,
    outcomes,
    choiceKey,
    onToggle
}: {
    nodes: IssueTreeNode[]
    checked: Set<number>
    outcomes: Record<string, StepOutcome>
    choiceKey: string
    onToggle: (id: number) => void
}) {
    const { t } = useI18n()
    return (
        <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
                <tbody>
                    {nodes.map((node) => {
                        const issue = node.issue
                        return (
                            <tr key={issue.id} className="border-b border-line last:border-b-0">
                                <td className="w-8 py-1.5 pl-3">
                                    <input
                                        type="checkbox"
                                        aria-label={`#${issue.id}`}
                                        checked={checked.has(issue.id)}
                                        onChange={() => onToggle(issue.id)}
                                    />
                                </td>
                                <td className="w-28 py-1.5 text-xs text-muted">{roleLabel(node, t)}</td>
                                <td className="py-1.5 pr-3" style={{ paddingLeft: node.depth * 16 }}>
                                    <span className="text-muted">
                                        {issue.tracker?.name} #{issue.id}
                                    </span>{' '}
                                    {issue.subject}
                                </td>
                                <td className="w-32 py-1.5 text-xs">{issue.status.name}</td>
                                <td className="w-36 truncate py-1.5 text-xs">{issue.assigned_to?.name ?? '—'}</td>
                                <td className="w-24 py-1.5 text-xs">{issue.fixed_version?.name ?? '—'}</td>
                                <td className="w-8 py-1.5 pr-3">
                                    <StepIcon outcome={outcomes[`${issue.id}:${choiceKey}`]} />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
