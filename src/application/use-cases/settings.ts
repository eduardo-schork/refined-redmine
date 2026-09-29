import { affectsMonitor, MIN_POLL_SECONDS, type SettingsPatch } from '@domain/settings/settings'
import type { SettingsView } from '../dto'
import type { SecretStore, SettingsRepository } from '../ports/repositories'
import type { Localization, LoginItem, ThemeController } from '../ports/system'
import type { MonitorService } from '../services/monitor-service'
import { toView } from './session'

function clampPollSeconds(patch: SettingsPatch): SettingsPatch {
    if (patch.pollSeconds === undefined) return patch
    return { ...patch, pollSeconds: Math.max(MIN_POLL_SECONDS, patch.pollSeconds) }
}

/** Updates preferences and applies the side effects (monitor, open at login, language). */
export class UpdateSettingsUseCase {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly secrets: SecretStore,
        private readonly monitor: MonitorService,
        private readonly loginItem: LoginItem,
        private readonly localization: Localization,
        private readonly theme: ThemeController
    ) {}

    execute(patch: SettingsPatch): SettingsView {
        const previous = this.settings.get()
        const cleanPatch = clampPollSeconds(patch)
        this.settings.save({ ...previous, ...cleanPatch })

        const { openAtLogin, language } = cleanPatch
        if (openAtLogin !== undefined && openAtLogin !== previous.openAtLogin)
            this.loginItem.setOpenAtLogin(openAtLogin)
        if (language && language !== previous.language) this.localization.setLanguage(language)
        const nextTheme = cleanPatch.appearance?.theme
        if (nextTheme && nextTheme !== previous.appearance.theme) this.theme.setThemeMode(nextTheme)

        if (affectsMonitor(previous, cleanPatch)) this.monitor.start()
        return toView(this.settings, this.secrets)
    }
}
