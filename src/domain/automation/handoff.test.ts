import { describe, expect, it } from 'vitest'
import type { Issue, IssueDetail, Journal } from '../redmine/entities'
import {
    cleanRule,
    defaultClosingChecks,
    DEFAULT_TEMPLATE,
    fillTemplate,
    fromStatusPath,
    neighbourIds,
    newRule,
    noteNumber,
    renderHandoffComment,
    rulesFor,
    statusPath,
    targetCandidates,
    viaFor,
    type HandoffRule
} from './handoff'

const issue = (id: number, trackerId: number, statusId = 1) =>
    ({ id, tracker: { id: trackerId, name: `T${trackerId}` }, status: { id: statusId } }) as Issue
const source = { id: 1201, subject: 'Checkout pelo CEP', trackerName: 'Desenvolvimento' }
const rule: HandoffRule = { ...newRule('r1', 'Enviar para QA'), trackerIds: [42], targetTrackerId: 43 }

describe('rulesFor', () => {
    it('shows a rule only on its trackers and statuses (empty = all)', () => {
        const onStatus = { ...rule, statusIds: [2] }
        expect(rulesFor([rule, onStatus], issue(1, 42, 2))).toEqual([rule, onStatus])
        expect(rulesFor([rule, onStatus], issue(1, 42, 1))).toEqual([rule])
        expect(rulesFor([rule], issue(1, 41))).toEqual([])
    })
})

describe('renderHandoffComment', () => {
    it('one note uses the template, with the tracker in lower case', () => {
        const comment = renderHandoffComment(rule, source, [{ issueId: 1201, number: 4 }])
        expect(comment).toBe('* Trâmite de desenvolvimento: #1201#note-4')
    })
    it('several notes repeat the note line, in issue and note order', () => {
        const notes = [
            { issueId: 1211, number: 1 },
            { issueId: 1201, number: 4 },
            { issueId: 1201, number: 2 }
        ]
        expect(renderHandoffComment(rule, source, notes)).toBe(
            '* Trâmites de desenvolvimento:\n  - #1201#note-2\n  - #1201#note-4\n  - #1211#note-1'
        )
        expect(renderHandoffComment(rule, source, [])).toBe('')
    })
    it('fills {{tarefa}} and {{titulo}}; notes are numbered like Redmine (every journal counts)', () => {
        expect(fillTemplate('Teste de {{tarefa}} - {{titulo}}', source)).toBe('Teste de #1201 - Checkout pelo CEP')
        const journals = [{ id: 10 }, { id: 11 }, { id: 15 }] as Journal[]
        expect(noteNumber(journals, 15)).toBe(3)
    })
})

describe('targets and closing steps', () => {
    const nearby = [
        { issue: issue(1300, 43) as IssueDetail, depth: 2 },
        { issue: issue(1211, 42) as IssueDetail, depth: 1 },
        { issue: issue(1250, 42) as IssueDetail, depth: 2 }
    ]
    it('targets are nearby issues of the target tracker', () => {
        expect(targetCandidates(nearby, rule).map((candidate) => candidate.issue.id)).toEqual([1300])
    })
    it('a closing step checks the issues with cited notes, else the closest of its tracker', () => {
        const step = { trackerId: 42, statusId: 5 }
        expect(defaultClosingChecks(step, nearby, [1250])).toEqual([1250])
        expect(defaultClosingChecks(step, nearby, [9999])).toEqual([1211])
        expect(defaultClosingChecks({ trackerId: 7, statusId: 5 }, nearby, [])).toEqual([])
    })
})

describe('cleanRule', () => {
    it('needs a name; an empty template of a send rule falls back to the default', () => {
        expect(() => cleanRule({ ...rule, name: ' ' })).toThrow('automation.nameRequired')
        expect(cleanRule({ ...rule, template: '' }).template).toBe(DEFAULT_TEMPLATE)
        expect(
            cleanRule({ ...rule, mode: 'same', template: '', closingSteps: [{ trackerId: 1, statusId: 2 }] })
        ).toMatchObject({
            template: '',
            closingSteps: []
        })
    })
    it('keeps the statuses to go through only with a final status, without blanks or the final one', () => {
        expect(cleanRule({ ...rule, statusId: 1, viaStatusIds: [12, 0, 1] }).viaStatusIds).toEqual([12])
        expect(cleanRule({ ...rule, statusId: undefined, viaStatusIds: [12] }).viaStatusIds).toEqual([])
        const closingSteps = [{ trackerId: 42, statusId: 5, viaStatusIds: [12, 5] }]
        expect(cleanRule({ ...rule, closingSteps }).closingSteps).toEqual([
            { trackerId: 42, statusId: 5, viaStatusIds: [12] }
        ])
    })
})

describe('status path', () => {
    it('is the statuses to go through, then the final one', () => {
        expect(statusPath({ statusId: 1, viaStatusIds: [12] })).toEqual([12, 1])
        expect(statusPath({ statusId: 1 })).toEqual([1])
        expect(statusPath({ viaStatusIds: [12] })).toEqual([])
        expect(fromStatusPath([12, 3, 1])).toEqual({ statusId: 1, viaStatusIds: [12, 3] })
        expect(fromStatusPath([])).toEqual({ statusId: undefined, viaStatusIds: [] })
    })
    it('applies only while the chosen status is the configured one', () => {
        const target = { statusId: 1, viaStatusIds: [12] }
        expect(viaFor(target, 1)).toEqual([12])
        expect(viaFor(target, 3)).toBeUndefined()
        expect(viaFor(target, undefined)).toBeUndefined()
    })
})

describe('neighbourIds', () => {
    it('parent, subtasks and the other side of relations, once each', () => {
        const opened = {
            id: 10,
            parent: { id: 1 },
            children: [{ id: 11 }, { id: 12 }],
            relations: [
                { id: 1, issue_id: 30, issue_to_id: 10, relation_type: 'relates' },
                { id: 2, issue_id: 10, issue_to_id: 11, relation_type: 'blocks' }
            ]
        } as IssueDetail
        expect(neighbourIds(opened)).toEqual([1, 11, 12, 30])
    })
})
