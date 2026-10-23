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
    it('hides the log from the sidebar unless it was explicitly turned on', () => {
        expect(withDefaults({}).showLog).toBe(false)
        expect(withDefaults({ showLog: 'yes' as unknown as boolean }).showLog).toBe(false)
        expect(withDefaults({ showLog: true }).showLog).toBe(true)
    })
})

describe('appearance', () => {
    it('invalid values from the file fall back to the defaults', () => {
        const appearance = withDefaults({
            appearance: { theme: 'neon', accent: 'red', scale: 300, darkPalette: 'black' } as never
        }).appearance
        expect(appearance).toMatchObject({ theme: 'system', accent: '#0085ff', scale: 100, darkPalette: 'black' })
    })
    it('picks readable text on the accent', () => {
        expect(textOnAccent('#c43a3a')).toBe('#ffffff')
        expect(textOnAccent('#facc15')).toBe('#000000')
        expect(darkThemeAccent('#000000')).toBe('#383838')
    })

    it('falls back to a daily update check for an unknown interval', () => {
        expect(withDefaults({ updates: { autoCheck: true, intervalHours: 7 } } as never).updates.intervalHours).toBe(24)
        expect(withDefaults({ updates: { autoCheck: false, intervalHours: 4 } } as never).updates).toEqual({
            autoCheck: false,
            intervalHours: 4
        })
        expect(withDefaults({ updates: { autoCheck: true } } as never).updates.intervalHours).toBe(24)
    })
})
