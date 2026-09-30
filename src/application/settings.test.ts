import { describe, expect, it } from 'vitest'
import { UpdateSettingsUseCase } from './use-cases/settings'
import { MemorySecrets, MemorySettings } from './testing/fakes'

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
