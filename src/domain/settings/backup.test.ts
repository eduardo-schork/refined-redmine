import { describe, expect, it } from 'vitest'
import { AppError } from '../shared/errors'
import { readBackup, settingsBackup } from './backup'
import { DEFAULT_SETTINGS } from './settings'

const settings = {
    ...DEFAULT_SETTINGS,
    baseUrl: 'https://redmine.example.com',
    user: { id: 1, login: 'ana', firstname: 'Ana', lastname: 'Lima' },
    lastSeenVersion: '0.11.0',
    pollSeconds: 120,
    showLog: true
}

describe('settings backup', () => {
    it('leaves the connection out of the file', () => {
        const backup = settingsBackup(settings, new Date('2026-10-26T12:00:00Z'))
        expect(backup).toMatchObject({ app: 'refined-redmine', format: 1, exportedAt: '2026-10-26T12:00:00.000Z' })
        expect(backup.settings).not.toHaveProperty('baseUrl')
        expect(backup.settings).not.toHaveProperty('user')
        expect(backup.settings).not.toHaveProperty('lastSeenVersion')
        expect(backup.settings.pollSeconds).toBe(120)
    })

    it('reads its own file back, filling what an older version did not have', () => {
        const text = JSON.stringify({ ...settingsBackup(settings, new Date()), settings: { pollSeconds: 90 } })
        const restored = readBackup(text)
        expect(restored.pollSeconds).toBe(90)
        expect(restored.boards).toEqual([])
        expect(restored).not.toHaveProperty('baseUrl')
    })

    it('refuses other files and backups from a newer version', () => {
        expect(() => readBackup('not json')).toThrow(AppError)
        expect(() => readBackup(JSON.stringify({ boards: [] }))).toThrow(AppError)
        const newer = JSON.stringify({ app: 'refined-redmine', format: 2, settings: {} })
        expect(() => readBackup(newer)).toThrowError(expect.objectContaining({ code: 'backup.newer' }))
    })
})
