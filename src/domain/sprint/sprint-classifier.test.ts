import { describe, expect, it } from 'vitest'
import type { Version } from '../redmine/entities'
import { activeSprints, classifySprints, compareVersions, detectDateFields, pickSprint } from './sprint-classifier'
import { DEFAULT_SPRINT_CONVENTIONS } from './sprint'

const makeVersion = (
    id: number,
    name: string,
    status: Version['status'],
    dev: string | null,
    pub: string | null
): Version => ({
    id,
    name,
    status,
    description: '',
    due_date: null,
    sharing: 'none',
    project: { id: 10, name: 'Loja Virtual' },
    custom_fields: [
        { id: 11, name: 'Prazo dos devs', value: dev },
        { id: 12, name: 'Publicação', value: pub },
        { id: 13, name: 'Hotfix', value: null }
    ]
})

// Actual Redmine state on 2026-09-28.
const versions = [
    makeVersion(660, 'backlog', 'open', null, null),
    makeVersion(2538, '3.76', 'closed', '2026-08-25', '2026-09-08'),
    makeVersion(2703, '3.76.1', 'closed', '', ''),
    makeVersion(2572, '3.77', 'closed', '2026-09-08', '2026-09-22'),
    makeVersion(2737, '3.77.1', 'open', '', ''),
    makeVersion(2604, '3.78', 'open', '2026-09-22', '2026-10-06'),
    makeVersion(2670, '3.79', 'open', '2026-10-06', '2026-10-20'),
    makeVersion(2736, '3.80', 'open', '2026-10-20', '2026-11-03')
]

describe('classifySprints', () => {
    const all = classifySprints(versions, DEFAULT_SPRINT_CONVENTIONS, '2026-09-28')
    const phase = (name: string) => all.find((sprint) => sprint.version.name === name)?.phase

    it('computes each version phase from the dates', () => {
        expect(phase('backlog')).toBe('other')
        expect(phase('3.76')).toBe('released')
        expect(phase('3.76.1')).toBe('released')
        expect(phase('3.77')).toBe('production')
        expect(phase('3.77.1')).toBe('hotfix')
        expect(phase('3.78')).toBe('qa')
        expect(phase('3.79')).toBe('dev')
        expect(phase('3.80')).toBe('planned')
    })

    it('estimates the start as the day after the previous dev deadline', () => {
        const start = (name: string) => all.find((sprint) => sprint.version.name === name)?.devStart
        expect(start('3.79')).toBe('2026-09-23')
        expect(start('3.78')).toBe('2026-09-09')
        expect(start('3.76')).toBeUndefined()
        expect(start('3.77.1')).toBeUndefined()
    })

    it('links the hotfix to its source sprint', () => {
        expect(all.find((sprint) => sprint.version.name === '3.77.1')?.baseName).toBe('3.77')
    })

    it('marks a late release when the date has passed and the sprint is still open', () => {
        const late = classifySprints(
            [makeVersion(1, '3.78', 'open', '2026-09-22', '2026-10-06')],
            DEFAULT_SPRINT_CONVENTIONS,
            '2026-10-07'
        )
        expect(late[0].phase).toBe('late')
    })

    it('sorts active sprints and resolves automatic sprints', () => {
        expect(activeSprints(all).map((sprint) => sprint.version.name)).toEqual([
            '3.77',
            '3.77.1',
            '3.78',
            '3.79',
            '3.80'
        ])
        expect(pickSprint(all, 'dev')?.version.name).toBe('3.79')
        expect(pickSprint(all, 'qa')?.version.name).toBe('3.78')
        expect(pickSprint(all, 'hotfix')?.version.name).toBe('3.77.1')
    })
})

describe('detectDateFields', () => {
    it('recognizes the fields by their names', () => {
        expect(detectDateFields(versions)).toMatchObject({ devDeadlineFieldId: 11, releaseFieldId: 12 })
    })
})

describe('compareVersions', () => {
    it('compares numerically', () => {
        expect(['3.10', '3.9', '3.10.1'].sort(compareVersions)).toEqual(['3.9', '3.10', '3.10.1'])
    })
})
