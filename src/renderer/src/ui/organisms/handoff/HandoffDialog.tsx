import { useMemo, useState } from 'react'
import {
    defaultClosingChecks,
    noteNumber,
    renderHandoffComment,
    ruleAppliesTo,
    targetCandidates,
    type CitedNote,
    type HandoffRule,
    type NearbyIssue
} from '@domain/automation/handoff'
import type { IssueDetail, Journal } from '@domain/redmine/entities'
import { parseIssueSearch } from '@domain/redmine/issue-search'
import { toggleSubtree } from '@domain/redmine/issue-tree'
import { useBulkEdit, useCommentAndChange, useIssue, useIssueTree, useNearbyIssues } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { useSteps, type Step } from '@/lib/steps'
import { Input, Select } from '../../atoms/fields'
import { Dialog } from '../../molecules/Dialog'
import { Field } from '../../molecules/Field'
import { StepsFooter } from '../../molecules/StepsFooter'
import { Alert } from '../../molecules/surfaces'
import { useToast } from '../../molecules/Toast'
import { ChoiceFields, choiceKeyOf, toChange, TreeTable, type Choices } from '../BulkEditDialog'
import { useChosenFiles } from '../IssueCreateDialog'
import { CommentWithFiles, HoursFields, useHandoffHours, useTimeSteps } from './HandoffParts'
import { ignoredNames, initialChoices, StepList, stepLabel } from './TramiteDialog'

const noteKey = (note: CitedNote) => `${note.issueId}#${note.number}`
const NOTES_SHOWN = 3

function lastNote(issue: IssueDetail): CitedNote | undefined {
    const withNotes = issue.journals.filter((journal) => journal.notes?.trim())
    const last = withNotes.at(-1)
    return last ? { issueId: issue.id, number: noteNumber(issue.journals, last.id) } : undefined
}

/** The opened issue, its subtasks and siblings of trackers the rule covers (not the target's): notes to cite. */
function noteSources(source: IssueDetail, nearby: NearbyIssue[], rule: HandoffRule): IssueDetail[] {
    const related = nearby
        .map((candidate) => candidate.issue)
        .filter((issue) => {
            const isSubtask = issue.parent?.id === source.id
            const isSibling = Boolean(source.parent) && issue.parent?.id === source.parent?.id
            const ofTarget = issue.tracker.id === rule.targetTrackerId
            return (isSubtask || isSibling) && !ofTarget && ruleAppliesTo(rule, issue.tracker.id)
        })
    return [source, ...related]
}

/** The trackers the search must find: the target's and those of the closing steps. */
const wantedTrackers = (rule: HandoffRule, source: IssueDetail) =>
    [...new Set([rule.targetTrackerId, ...rule.closingSteps.map((step) => step.trackerId)])].filter(
        (id): id is number => id !== undefined && id !== source.tracker.id
    )

/**
 * Sends a handoff to a nearby issue: cites chosen notes of this issue (and of its subtasks and siblings) in a
 * comment on the target, changes its status, assignee and version, logs the hours here and may close issues around.
 */
export function HandoffDialog({
    source,
    rules,
    initialRuleId,
    initialJournalId,
    onClose
}: {
    source: IssueDetail
    rules: HandoffRule[]
    initialRuleId: string
    initialJournalId?: number
    onClose: () => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const [ruleId, setRuleId] = useState(initialRuleId)
    const rule = rules.find((candidate) => candidate.id === ruleId) ?? rules[0]
    const nearbyQuery = useNearbyIssues(source.id, wantedTrackers(rule, source))
    const nearby = useMemo(() => nearbyQuery.data ?? [], [nearbyQuery.data])
    const notes = useCitedNotes(source, initialJournalId, rule)
    const target = useTarget(nearby, rule)
    const [choices, setChoices] = useState<Choices>(() => initialChoices(rule))
    const files = useChosenFiles()
    const hours = useHandoffHours(rule)
    const extras = useTargetExtras(target.issue, rule.bulk)
    const closing = useClosing(rule, source, nearby, notes.picked)
    const commentAndChange = useCommentAndChange()
    const bulkEdit = useBulkEdit()
    const steps = useSteps(error)

    const pickRule = (id: string) => {
        const next = rules.find((candidate) => candidate.id === id) ?? rule
        setRuleId(id)
        setChoices(initialChoices(next))
        notes.reset(next)
    }
    const targetId = target.issue?.id
    const change = { ...toChange(choices), notes: notes.comment }
    const contentKey = `${choiceKeyOf(choices)}:${notes.comment.length}:${files.uploads.length}`
    const commentStep = (id: number): Step => ({
        key: `comment:${id}:${contentKey}`,
        run: async () => {
            const result = await commentAndChange.mutateAsync({ id, change, uploads: files.uploads })
            if (result.outcome === 'partial')
                return t('handoff.notApplied', { id, fields: ignoredNames(result.ignored, t) })
        }
    })
    const closeStep = (id: number, statusId: number): Step => ({
        key: `close:${id}:${statusId}`,
        run: async () => {
            const result = await bulkEdit.mutateAsync({ id, change: { statusId } })
            if (result.outcome === 'partial') throw new Error(t('handoff.statusNotApplied', { id }))
        }
    })
    const timeSteps = useTimeSteps(hours, source.id, targetId ? `${rule.name} → #${targetId}` : rule.name)
    const planned: Step[] = targetId
        ? [
              commentStep(targetId),
              ...[...extras.checked].map(commentStep),
              ...timeSteps,
              ...closing.moves.map((move) => closeStep(move.issueId, move.statusId))
          ]
        : []
    const ready = Boolean(targetId) && Boolean(notes.comment.trim()) && !hours.blocked

    const send = async () => {
        const clean = await steps.run(planned)
        if (!clean) return
        toast(t('handoff.sentTo', { id: targetId }))
        onClose()
    }

    const footer = (
        <StepsFooter
            planned={planned}
            outcomes={steps.outcomes}
            pending={steps.pending(planned).length}
            running={steps.running}
            ready={ready}
            startLabel={targetId ? t('handoff.sendTo', { id: targetId }) : t('handoff.send')}
            onStart={() => void send()}
            onClose={onClose}
        />
    )

    return (
        <Dialog title={`${rule.name} · #${source.id}`} onClose={onClose} size="xl" footer={footer}>
            <div className="flex flex-col gap-5">
                {rules.length > 1 && (
                    <Field label={t('handoff.rule')}>
                        <Select className="w-72" value={rule.id} onChange={(event) => pickRule(event.target.value)}>
                            {rules.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                )}
                {nearbyQuery.isError && <Alert>{error(nearbyQuery.error)}</Alert>}
                <NotePicker sources={noteSources(source, nearby, rule)} notes={notes} />
                <TargetPicker
                    candidates={targetCandidates(nearby, rule)}
                    target={target}
                    loading={nearbyQuery.isLoading}
                />
                {target.issue && (
                    <ChoiceFields projectId={target.issue.project.id} choices={choices} onChange={setChoices} />
                )}
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
                <CommentWithFiles comment={notes.comment} onComment={notes.setComment} files={files} />
                <HoursFields hours={hours} />
                <ClosingFields closing={closing} />
                <StepList planned={planned} outcomes={steps.outcomes} labelOf={(key) => stepLabel(key, t)} />
            </div>
        </Dialog>
    )
}

/** Picked notes and the comment rendered from them; picking again rewrites the comment (edits are lost). */
function useCitedNotes(source: IssueDetail, initialJournalId: number | undefined, rule: HandoffRule) {
    const template = { id: source.id, subject: source.subject, trackerName: source.tracker.name }
    const initial = initialJournalId
        ? { issueId: source.id, number: noteNumber(source.journals, initialJournalId) }
        : lastNote(source)
    const [picked, setPicked] = useState<CitedNote[]>(initial ? [initial] : [])
    const [comment, setComment] = useState(() => renderHandoffComment(rule, template, picked))
    const toggle = (note: CitedNote) => {
        const isPicked = picked.some((other) => noteKey(other) === noteKey(note))
        const next = isPicked ? picked.filter((other) => noteKey(other) !== noteKey(note)) : [...picked, note]
        setPicked(next)
        setComment(renderHandoffComment(rule, template, next))
    }
    const reset = (nextRule: HandoffRule) => setComment(renderHandoffComment(nextRule, template, picked))
    return { picked, toggle, comment, setComment, reset }
}

type CitedNotes = ReturnType<typeof useCitedNotes>

function NotePicker({ sources, notes }: { sources: IssueDetail[]; notes: CitedNotes }) {
    const { t } = useI18n()
    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">{t('handoff.notes')}</span>
            {sources.map((issue) => (
                <IssueNotes key={issue.id} issue={issue} notes={notes} />
            ))}
        </div>
    )
}

/** Newest first; the last three (and any picked one) show until "show all". */
function IssueNotes({ issue, notes }: { issue: IssueDetail; notes: CitedNotes }) {
    const { t, dates } = useI18n()
    const [showAll, setShowAll] = useState(false)
    const withNotes = issue.journals.filter((journal) => journal.notes?.trim()).reverse()
    const isPicked = (journal: Journal) =>
        notes.picked.some((note) => note.issueId === issue.id && note.number === noteNumber(issue.journals, journal.id))
    const shown = showAll ? withNotes : withNotes.filter((journal, index) => index < NOTES_SHOWN || isPicked(journal))
    if (!withNotes.length) return null
    return (
        <div className="rounded-lg border border-line">
            <div className="border-b border-line px-3 py-1.5 text-xs text-muted">
                {issue.tracker.name} #{issue.id} {issue.subject}
            </div>
            {shown.map((journal) => {
                const number = noteNumber(issue.journals, journal.id)
                return (
                    <label
                        key={journal.id}
                        className="flex gap-2 border-b border-line px-3 py-1.5 text-sm last:border-b-0"
                    >
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={isPicked(journal)}
                            onChange={() => notes.toggle({ issueId: issue.id, number })}
                        />
                        <span className="min-w-0 flex-1">
                            <span className="text-xs text-muted">
                                #note-{number} · {journal.user.name} · {dates.dateTime(journal.created_on)}
                            </span>
                            <span className="line-clamp-2 block">{journal.notes}</span>
                        </span>
                    </label>
                )
            })}
            {withNotes.length > shown.length && (
                <button className="px-3 py-1.5 text-xs text-accent hover:underline" onClick={() => setShowAll(true)}>
                    {t('handoff.allNotes', { count: withNotes.length })}
                </button>
            )}
        </div>
    )
}

/** The candidate chosen in the list, or an issue typed by number; a single candidate is chosen by itself. */
function useTarget(nearby: NearbyIssue[], rule: HandoffRule) {
    const [chosenId, setChosenId] = useState<number>()
    const [typed, setTyped] = useState('')
    const candidates = targetCandidates(nearby, rule)
    const onlyOne = candidates.length === 1 ? candidates[0].issue.id : undefined
    const id = chosenId ?? onlyOne
    const fromList = candidates.find((candidate) => candidate.issue.id === id)?.issue
    const typedIssue = useIssue(id ?? 0, Boolean(id) && !fromList)
    const applyTyped = () => {
        const reference = parseIssueSearch(typed)
        if (reference.type === 'id') setChosenId(reference.id)
    }
    return {
        id,
        issue: fromList ?? (id ? typedIssue.data : undefined),
        choose: setChosenId,
        typed,
        setTyped,
        applyTyped
    }
}

function TargetPicker({
    candidates,
    target,
    loading
}: {
    candidates: NearbyIssue[]
    target: ReturnType<typeof useTarget>
    loading: boolean
}) {
    const { t } = useI18n()
    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">{t('handoff.target')}</span>
            {loading && <span className="text-sm text-muted">{t('handoff.searching')}</span>}
            {!loading && candidates.length === 0 && (
                <span className="text-sm text-muted">{t('handoff.noCandidates')}</span>
            )}
            {candidates.map(({ issue }) => (
                <label key={issue.id} className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={target.id === issue.id} onChange={() => target.choose(issue.id)} />
                    <span className="text-muted">
                        {issue.tracker.name} #{issue.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{issue.subject}</span>
                    <span className="text-xs text-muted">
                        {issue.status.name} · {issue.assigned_to?.name ?? '—'}
                    </span>
                </label>
            ))}
            <div className="flex items-center gap-2">
                <Input
                    className="w-40"
                    placeholder={t('handoff.otherIssue')}
                    value={target.typed}
                    onChange={(event) => target.setTyped(event.target.value)}
                    onBlur={target.applyTyped}
                />
                {target.issue && !candidates.some((candidate) => candidate.issue.id === target.id) && (
                    <span className="truncate text-sm text-muted">{target.issue.subject}</span>
                )}
            </div>
        </div>
    )
}

function useTargetExtras(target: IssueDetail | undefined, enabled: boolean) {
    const tree = useIssueTree(target?.id ?? 0, enabled && Boolean(target))
    const nodes = enabled && target ? (tree.data ?? []).filter((node) => node.issue.id !== target.id) : []
    const [checked, setChecked] = useState(new Set<number>())
    return { nodes, checked, toggle: (id: number) => setChecked(toggleSubtree(nodes, checked, id)) }
}

/** For each closing step, the issues of its tracker with checkboxes; an issue moves only in the first step. */
function useClosing(rule: HandoffRule, source: IssueDetail, nearby: NearbyIssue[], picked: CitedNote[]) {
    const known: NearbyIssue[] = [{ issue: source, depth: 0 }, ...nearby]
    const preferred = [source.id, ...picked.map((note) => note.issueId)]
    const [overrides, setOverrides] = useState<Record<string, boolean>>({})
    const [statusOverrides, setStatusOverrides] = useState<Record<number, number>>({})
    const groups = rule.closingSteps.map((step, index) => {
        const defaults = new Set(defaultClosingChecks(step, known, preferred))
        const issues = known
            .filter((candidate) => candidate.issue.tracker.id === step.trackerId)
            .map((candidate) => candidate.issue)
        const isChecked = (id: number) => overrides[`${index}:${id}`] ?? defaults.has(id)
        return { index, step, statusId: statusOverrides[index] ?? step.statusId, issues, isChecked }
    })
    const moved = new Set<number>()
    const moves = groups.flatMap((group) =>
        group.issues
            .filter((issue) => group.isChecked(issue.id) && group.statusId && !moved.has(issue.id))
            .map((issue) => {
                moved.add(issue.id)
                return { issueId: issue.id, statusId: group.statusId }
            })
    )
    const toggle = (index: number, id: number, checked: boolean) =>
        setOverrides((current) => ({ ...current, [`${index}:${id}`]: checked }))
    const setStatus = (index: number, statusId: number) =>
        setStatusOverrides((current) => ({ ...current, [index]: statusId }))
    return { groups, moves, toggle, setStatus }
}

function ClosingFields({ closing }: { closing: ReturnType<typeof useClosing> }) {
    const { t } = useI18n()
    const statuses = useStatuses().data ?? []
    return closing.groups.map((group) => (
        <div key={group.index} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted">{t('handoff.closing')}</span>
                <Select
                    className="w-56"
                    value={group.statusId || ''}
                    onChange={(event) => closing.setStatus(group.index, Number(event.target.value))}
                >
                    <option value="">{t('handoff.dontChange')}</option>
                    {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                            {status.name}
                        </option>
                    ))}
                </Select>
            </div>
            {group.issues.length === 0 && <span className="text-sm text-muted">{t('handoff.noneOfTracker')}</span>}
            {group.issues.map((issue) => (
                <label key={issue.id} className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={group.isChecked(issue.id)}
                        onChange={(event) => closing.toggle(group.index, issue.id, event.target.checked)}
                    />
                    <span className="text-muted">
                        {issue.tracker.name} #{issue.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{issue.subject}</span>
                    <span className="text-xs text-muted">{issue.status.name}</span>
                </label>
            ))}
        </div>
    ))
}
