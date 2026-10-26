import { describe, expect, it } from 'vitest'
import { BackupUseCases } from './use-cases/backup'
import { UpdateSettingsUseCase } from './use-cases/settings'
import { FixedClock, MemorySecrets, MemorySettings } from './testing/fakes'

function setup() {
    const settings = new MemorySettings()
    const restarts: string[] = []
    const noop = () => {}
    const useCase = new UpdateSettingsUseCase(
        settings,
        new MemorySecrets(),
        { start: () => restarts.push('monitor') } as never,
        { setOpenAtLogin: noop } as never,
        { setLanguage: noop } as never,
        { setThemeMode: noop } as never,
        { start: () => restarts.push('updates') }
    )
    return { settings, restarts, useCase }
}

describe('UpdateSettingsUseCase', () => {
    it('saves a valid update interval and restarts the update checks', () => {
        const { settings, restarts, useCase } = setup()
        useCase.execute({ updates: { autoCheck: true, intervalHours: 4 } })
        expect(settings.value.updates.intervalHours).toBe(4)
        expect(restarts).toEqual(['updates'])
    })

    it('never saves an interval outside the choices', () => {
        const { settings, useCase } = setup()
        useCase.execute({ updates: { autoCheck: true, intervalHours: 0 } })
        expect(settings.value.updates.intervalHours).toBe(24)
    })
})

describe('BackupUseCases', () => {
    it('saves the settings without the connection and brings them back from the file', async () => {
        const { settings, useCase } = setup()
        settings.value = { ...settings.value, pollSeconds: 120 }
        const written: { name: string; text: string }[] = []
        const files = {
            saveText: async (name: string, text: string) => {
                written.push({ name, text })
                return true
            },
            openText: async () => written[0]?.text ?? null
        }
        const backup = new BackupUseCases(settings, files, useCase, new FixedClock(new Date(2026, 9, 26, 12)))

        expect(await backup.exportToFile()).toBe(true)
        expect(written[0].name).toBe('refined-redmine-settings-2026-10-26.json')
        expect(written[0].text).not.toContain('redmine.test')

        settings.value = { ...settings.value, pollSeconds: 300 }
        const view = await backup.importFromFile()
        expect(view?.pollSeconds).toBe(120)
        expect(settings.value.baseUrl).toBe('https://redmine.test')
    })

    it('does nothing when the file dialog is cancelled', async () => {
        const { settings, useCase } = setup()
        const files = { saveText: async () => false, openText: async () => null }
        const backup = new BackupUseCases(settings, files, useCase, new FixedClock(new Date()))
        expect(await backup.importFromFile()).toBeNull()
    })
})
