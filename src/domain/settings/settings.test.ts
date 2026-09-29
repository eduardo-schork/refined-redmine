import { describe, expect, it } from 'vitest'
import { darkThemeAccent, textOnAccent } from './appearance'
import { withDefaults } from './settings'

describe('withDefaults', () => {
    it('upgrades the old scopes, event switches and custom queries into monitors', () => {
        const settings = withDefaults({
            scopes: { assigned: true, watched: false, authored: true },
            eventKinds: { comment: false, unqueued: false, reminder: false },
            customQueries: [{ id: 'q1', name: 'Bugs', queryId: 71, alertOn: 'increase', enabled: true }]
        })
        const [mine, query] = settings.monitors
        expect(mine).toMatchObject({
            id: 'mine',
            source: { type: 'mine', scopes: { assigned: true, watched: false, authored: true } },
            events: { comment: false, left: false, status: true }
        })
        expect(query).toMatchObject({
            id: 'q1',
            source: { type: 'query', queryId: 71 },
            events: { entered: true, left: false, status: false }
        })
        expect(settings.reminderHistory).toBe(false)
        expect(settings).not.toHaveProperty('eventKinds')
    })
    it('always keeps "my issues" first', () => {
        const other = {
            id: 'x',
            name: 'X',
            enabled: true,
            source: { type: 'filter' as const, url: '/issues' },
            events: withDefaults({}).monitors[0].events
        }
        expect(withDefaults({ monitors: [other] }).monitors.map((monitor) => monitor.id)).toEqual(['mine', 'x'])
    })
})

describe('appearance', () => {
    it('invalid values from the file fall back to the defaults', () => {
        const appearance = withDefaults({
            appearance: { theme: 'neon', accent: 'red', scale: 300, darkPalette: 'black' } as never
        }).appearance
        expect(appearance).toMatchObject({ theme: 'system', accent: '#c43a3a', scale: 100, darkPalette: 'black' })
    })
    it('picks readable text on the accent', () => {
        expect(textOnAccent('#c43a3a')).toBe('#ffffff')
        expect(textOnAccent('#facc15')).toBe('#000000')
        expect(darkThemeAccent('#000000')).toBe('#383838')
    })
})
