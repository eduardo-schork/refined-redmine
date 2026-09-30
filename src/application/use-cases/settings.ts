import { withIssueStyleDefaults } from '@domain/redmine/issue-style'
import {
    affectsMonitor,
    MIN_POLL_SECONDS,
    withUpdateDefaults,
    type Settings,
    type SettingsPatch
} from '@domain/settings/settings'
import type { SettingsView } from '../dto'
import type { SecretStore, SettingsRepository } from '../ports/repositories'
import type { Localization, LoginItem, ThemeController } from '../ports/system'
import type { MonitorService } from '../services/monitor-service'
import { toView } from './session'

function clampPollSeconds(patch: SettingsPatch): SettingsPatch {
    if (patch.pollSeconds === undefined) return patch
    return { ...patch, pollSeconds: Math.max(MIN_POLL_SECONDS, patch.pollSeconds) }
}

/** Status colors and priority levels come from the interface; unknown values are dropped before saving. */
function cleanIssueStyle(patch: SettingsPatch): SettingsPatch {
    if (patch.issueStyle === undefined) return patch
    return { ...patch, issueStyle: withIssueStyleDefaults(patch.issueStyle) }
}

/** An interval outside the choices would make a timer that fires too often: it falls back to once a day. */
function cleanUpdates(patch: SettingsPatch): SettingsPatch {
    if (patch.updates === undefined) return patch
    return { ...patch, updates: withUpdateDefaults(patch.updates) }
}

function updateScheduleChanged(previous: Settings, patch: SettingsPatch): boolean {
    if (!patch.updates) return false
    const autoCheckChanged = patch.updates.autoCheck !== previous.updates.autoCheck
    const intervalChanged = patch.updates.intervalHours !== previous.updates.intervalHours
    return autoCheckChanged || intervalChanged
}

/** Updates preferences and applies the side effects (monitor, open at login, language). */
export class UpdateSettingsUseCase {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly secrets: SecretStore,
        private readonly monitor: MonitorService,
        private readonly loginItem: LoginItem,
        private readonly localization: Localization,
        private readonly theme: ThemeController,
        private readonly updates: { start(): void }
    ) {}

    execute(patch: SettingsPatch): SettingsView {
        const previous = this.settings.get()
        const cleanPatch = cleanUpdates(cleanIssueStyle(clampPollSeconds(patch)))
        this.settings.save({ ...previous, ...cleanPatch })

        const { openAtLogin, language } = cleanPatch
        if (openAtLogin !== undefined && openAtLogin !== previous.openAtLogin)
            this.loginItem.setOpenAtLogin(openAtLogin)
        if (language && language !== previous.language) this.localization.setLanguage(language)
        const nextTheme = cleanPatch.appearance?.theme
        if (nextTheme && nextTheme !== previous.appearance.theme) this.theme.setThemeMode(nextTheme)

        if (affectsMonitor(previous, cleanPatch)) this.monitor.start()
        if (updateScheduleChanged(previous, cleanPatch)) this.updates.start()
        return toView(this.settings, this.secrets)
    }
}
