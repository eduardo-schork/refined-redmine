import type { Issue, IssueDetail, Journal } from '../redmine/entities'
import { relationFrom } from '../redmine/relations'
import { AppError } from '../shared/errors'

/**
 * A "trâmite" button in the issue detail. `same`: comment and move the issue itself. `other`: send a comment that
 * cites notes of this issue to a nearby issue of another tracker (Development → Quality), change that issue and
 * optionally close issues around it.
 */
export interface HandoffRule {
    id: string
    name: string
    mode: 'same' | 'other'
    /** Name of the icon of its button and menu item; undefined = the default one. */
    icon?: string
    /** Where the button shows; empty = every tracker / status. */
    trackerIds: number[]
    statusIds: number[]
    /** `other`: tracker of the issue that receives the comment; undefined = any nearby issue. */
    targetTrackerId?: number
    /** Default new status and assignee (of the target, or of the issue itself); undefined = keep. */
    statusId?: number
    /** Statuses set one by one before `statusId`, when the workflow does not allow going straight to it. */
    viaStatusIds?: number[]
    assigneeId?: number
    assigneeName?: string
    /** Comment with one cited note (`other`), or the prefilled comment (`same`). */
    template: string
    /** `other`, with two or more cited notes. */
    multiTemplate: string
    logTime: boolean
    timeActivityId?: number
    /** Also apply the comment, status, assignee and version to checked linked issues. */
    bulk: boolean
    /** `other`: statuses to set on nearby issues of each tracker after sending (for example close the tasks). */
    closingSteps: ClosingStep[]
}

export interface ClosingStep {
    trackerId: number
    statusId: number
    viaStatusIds?: number[]
}

interface StatusTarget {
    statusId?: number
    viaStatusIds?: number[]
}

/** The statuses in the order they are set: the ones to go through, then the final one. */
export function statusPath(target: StatusTarget): number[] {
    if (!target.statusId) return []
    return [...(target.viaStatusIds ?? []), target.statusId]
}

export function fromStatusPath(path: number[]): { statusId?: number; viaStatusIds: number[] } {
    return { statusId: path.at(-1), viaStatusIds: path.slice(0, -1) }
}

/** The statuses to go through, while the status chosen when sending is the configured one (another goes straight). */
export function viaFor(target: StatusTarget, chosenStatusId: number | undefined): number[] | undefined {
    if (!target.statusId || chosenStatusId !== target.statusId) return undefined
    return target.viaStatusIds
}

/** Without a final status there is nothing to go through; empty picks and the final status itself are dropped. */
function cleanVia(target: StatusTarget): number[] {
    if (!target.statusId) return []
    return (target.viaStatusIds ?? []).filter((id) => id && id !== target.statusId)
}

export const NOTE_PLACEHOLDER = '{{noteSelecionado}}'
export const DEFAULT_TEMPLATE = `* Trâmite de {{tipoAtividadeComentario}}: ${NOTE_PLACEHOLDER}`
export const DEFAULT_MULTI_TEMPLATE = `* Trâmites de {{tipoAtividadeComentario}}:\n  - ${NOTE_PLACEHOLDER}`
export const MAX_RULES = 30

/** "Novo trâmite": always offered, on any issue; comment, status, assignee, version and hours on the issue itself. */
export const NEW_TRAMITE_RULE: HandoffRule = {
    id: 'new-tramite',
    name: '',
    mode: 'same',
    trackerIds: [],
    statusIds: [],
    template: '',
    multiTemplate: '',
    logTime: true,
    bulk: true,
    closingSteps: []
}

export function newRule(id: string, name: string): HandoffRule {
    return {
        ...NEW_TRAMITE_RULE,
        id,
        name,
        mode: 'other',
        template: DEFAULT_TEMPLATE,
        multiTemplate: DEFAULT_MULTI_TEMPLATE,
        logTime: false,
        bulk: false
    }
}

const matches = (allowed: number[], value: number) => allowed.length === 0 || allowed.includes(value)

/** The rules whose button shows on this issue, in the configured order. */
export function rulesFor(rules: HandoffRule[], issue: Pick<Issue, 'tracker' | 'status'>): HandoffRule[] {
    return rules.filter(
        (rule) => matches(rule.trackerIds, issue.tracker.id) && matches(rule.statusIds, issue.status.id)
    )
}

/** Whether a tracker takes part in the rule (notes are cited from it, hours are logged on it). */
export const ruleAppliesTo = (rule: HandoffRule, trackerId: number) => matches(rule.trackerIds, trackerId)

/** Saved rules: trimmed name and templates; empty `other` templates fall back to the defaults. */
export function cleanRule(rule: HandoffRule): HandoffRule {
    const name = rule.name.trim()
    if (!name) throw new AppError('automation.nameRequired')
    const isOther = rule.mode === 'other'
    const template = rule.template.trim() || (isOther ? DEFAULT_TEMPLATE : '')
    const multiTemplate = rule.multiTemplate.trim() || DEFAULT_MULTI_TEMPLATE
    const closingSteps = isOther
        ? rule.closingSteps
              .filter((step) => step.trackerId && step.statusId)
              .map((step) => ({ ...step, viaStatusIds: cleanVia(step) }))
        : []
    return {
        ...rule,
        name,
        template,
        multiTemplate,
        viaStatusIds: cleanVia(rule),
        closingSteps,
        timeActivityId: rule.logTime ? rule.timeActivityId : undefined
    }
}

export function assertValidRules(rules: HandoffRule[]): HandoffRule[] {
    if (rules.length > MAX_RULES) throw new AppError('automation.tooMany', { max: MAX_RULES })
    return rules.map(cleanRule)
}

/** A note of an issue, cited as `#1234#note-3` (Redmine numbers the journals from 1, notes or not). */
export interface CitedNote {
    issueId: number
    number: number
}

export function noteNumber(journals: Journal[], journalId: number): number {
    return journals.findIndex((journal) => journal.id === journalId) + 1
}

const noteLink = (note: CitedNote) => `#${note.issueId}#note-${note.number}`

export interface TemplateIssue {
    id: number
    subject: string
    trackerName: string
}

/** {{tarefa}} → #1234, {{titulo}} → title, {{tipoAtividadeComentario}} → tracker name in lower case. */
export function fillTemplate(template: string, issue: TemplateIssue): string {
    return template
        .replaceAll('{{tarefa}}', `#${issue.id}`)
        .replaceAll('{{titulo}}', issue.subject)
        .replaceAll('{{tipoAtividadeComentario}}', issue.trackerName.toLowerCase())
}

/**
 * The comment of an `other` rule: notes in issue and note order; with two or more the multi-note template is used,
 * and every line holding {{noteSelecionado}} is repeated once per note. No note, no comment.
 */
export function renderHandoffComment(rule: HandoffRule, source: TemplateIssue, notes: CitedNote[]): string {
    if (!notes.length) return ''
    const ordered = [...notes].sort((first, second) => first.issueId - second.issueId || first.number - second.number)
    const template = ordered.length > 1 ? rule.multiTemplate : rule.template
    const lines = template.split('\n').flatMap((line) => {
        if (!line.includes(NOTE_PLACEHOLDER)) return [line]
        return ordered.map((note) => line.replaceAll(NOTE_PLACEHOLDER, noteLink(note)))
    })
    return fillTemplate(lines.join('\n'), source)
}

/** A nearby issue found from the opened one, and how many links away (parent, subtask, relation) it is. */
export interface NearbyIssue {
    /** Read with journals, so its notes can be cited. */
    issue: IssueDetail
    depth: number
}

/** Issues one link away: the parent, the subtasks and the other side of each relation. */
export function neighbourIds(issue: IssueDetail): number[] {
    const ids = [
        ...(issue.parent ? [issue.parent.id] : []),
        ...issue.children.map((child) => child.id),
        ...issue.relations.map((relation) => relationFrom(issue.id, relation).otherId)
    ]
    return [...new Set(ids)].filter((id) => id !== issue.id)
}

/** Closest issues are read first; the search stops here even if a tracker was not found. */
export const MAX_NEARBY_READS = 60

/** Issues that receive the comment: nearby issues of the target tracker, closest first. */
export function targetCandidates(nearby: NearbyIssue[], rule: HandoffRule): NearbyIssue[] {
    if (rule.targetTrackerId === undefined) return nearby
    return nearby.filter((candidate) => candidate.issue.tracker.id === rule.targetTrackerId)
}

/**
 * Issues a closing step checks by default: the opened issue and those with cited notes, when of the step's tracker;
 * otherwise the closest issue of that tracker.
 */
export function defaultClosingChecks(step: ClosingStep, known: NearbyIssue[], preferredIds: number[]): number[] {
    const ofTracker = known.filter((candidate) => candidate.issue.tracker.id === step.trackerId)
    const preferred = ofTracker.filter((candidate) => preferredIds.includes(candidate.issue.id))
    if (preferred.length) return preferred.map((candidate) => candidate.issue.id)
    const closest = [...ofTracker].sort((first, second) => first.depth - second.depth)[0]
    return closest ? [closest.issue.id] : []
}
