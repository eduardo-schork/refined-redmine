import { useState, type KeyboardEvent } from 'react'
import type { IssueDetail } from '@domain/redmine/entities'
import {
    subtreeIds,
    toggleSubtree,
    treeGuides,
    type BulkChange,
    type IssueTreeNode,
    type TreeGuide
} from '@domain/redmine/issue-tree'
import { useBulkEdit, useIssueEditOptions, useIssueTree } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { stepProblems, useSteps, type Step, type StepOutcome } from '@/lib/steps'
import { Select } from '../atoms/fields'
import { Dialog } from '../molecules/Dialog'
import { Field } from '../molecules/Field'
import { PickList } from '../molecules/PickList'
import { StepIcon } from '../molecules/StepIcon'
import { StepProblems } from '../molecules/StepProblems'
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
    const labelOf = (key: string) => {
        const id = Number(key.split(':')[0])
        const node = nodes.find((candidate) => candidate.issue.id === id)
        return node ? `#${id} ${node.issue.subject}` : `#${id}`
    }

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
                <StepProblems problems={stepProblems(plannedSteps, steps.outcomes, labelOf)} />
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
                <PickList
                    value={choices.assignee}
                    options={[
                        { value: KEEP, label: t('bulk.keep') },
                        { value: CLEAR, label: t('issue.edit.nobody') },
                        ...(options?.assignees ?? []).map((person) => ({
                            value: String(person.id),
                            label: person.name
                        }))
                    ]}
                    searchPlaceholder={t('issue.edit.searchPerson')}
                    noMatches={t('issue.edit.noPerson')}
                    onPick={(option) => update({ assignee: option.value })}
                />
            </Field>
            <Field label={t('issue.version')}>
                <PickList
                    value={choices.version}
                    options={[
                        { value: KEEP, label: t('bulk.keep') },
                        { value: CLEAR, label: t('issue.edit.noVersion') },
                        ...(options?.versions ?? []).map((version) => ({
                            value: String(version.id),
                            label: version.name
                        }))
                    ]}
                    onPick={(option) => update({ version: option.value })}
                />
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
    const guides = treeGuides(nodes)
    return (
        <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
                <tbody>
                    {nodes.map((node, index) => {
                        const issue = node.issue
                        const isChecked = checked.has(issue.id)
                        // The whole row checks the issue: the box alone was too small a target.
                        const toggleOnKey = (event: KeyboardEvent) => {
                            if (event.key !== ' ' && event.key !== 'Enter') return
                            event.preventDefault()
                            onToggle(issue.id)
                        }
                        return (
                            <tr
                                key={issue.id}
                                role="checkbox"
                                aria-checked={isChecked}
                                tabIndex={0}
                                onClick={() => onToggle(issue.id)}
                                onKeyDown={toggleOnKey}
                                className={cn(
                                    'cursor-pointer border-b border-line outline-none last:border-b-0 hover:bg-panel-2 focus-visible:bg-panel-2',
                                    isChecked && 'bg-accent-soft/40'
                                )}
                            >
                                <td className="w-8 py-1.5 pl-3">
                                    <input
                                        type="checkbox"
                                        tabIndex={-1}
                                        aria-hidden
                                        readOnly
                                        checked={isChecked}
                                        className="pointer-events-none"
                                    />
                                </td>
                                <td className="w-28 py-1.5 text-xs text-muted">{roleLabel(node, t)}</td>
                                <td className="py-1.5 pr-3">
                                    <span className="flex items-baseline">
                                        <TreeBranch depth={node.depth} guide={guides[index]} />
                                        <span className="min-w-0">
                                            <span className="text-muted">
                                                {issue.tracker?.name} #{issue.id}
                                            </span>{' '}
                                            {issue.subject}
                                        </span>
                                    </span>
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

/** "│  ├─ " before a subtask: which issue it hangs from, like a folder tree. */
function TreeBranch({ depth, guide }: { depth: number; guide: TreeGuide }) {
    if (depth === 0) return null
    const levels = guide.lines.map((continues) => (continues ? '│  ' : '   ')).join('')
    const branch = guide.last ? '└─ ' : '├─ '
    return <span className="shrink-0 whitespace-pre font-mono text-muted">{`${levels}${branch}`}</span>
}
