import { AppError } from '../shared/errors'
import { withDefaults, type Settings, type SettingsPatch } from './settings'

export const BACKUP_APP = 'refined-redmine'
export const BACKUP_FORMAT = 1
/** A settings file is a few kilobytes; anything far larger is not a backup. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

/** The app's own settings in a file: boards, monitors, automations, teams, appearance and preferences. */
export interface SettingsBackup {
    app: typeof BACKUP_APP
    format: number
    exportedAt: string
    settings: SettingsPatch
}

/** Settings that belong to this login and this computer, not to a backup. */
function withoutConnection(settings: Settings): SettingsPatch {
    const { baseUrl: _baseUrl, user: _user, lastSeenVersion: _lastSeenVersion, ...portable } = settings
    return portable
}

/**
 * What leaves the computer. The connection (Redmine address and user) stays out; the API key and the GitHub token
 * are not part of the settings at all.
 */
export function settingsBackup(settings: Settings, now: Date): SettingsBackup {
    return {
        app: BACKUP_APP,
        format: BACKUP_FORMAT,
        exportedAt: now.toISOString(),
        settings: withoutConnection(settings)
    }
}

function isBackup(value: unknown): value is SettingsBackup {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Partial<SettingsBackup>
    const hasSettings = typeof candidate.settings === 'object' && candidate.settings !== null
    return candidate.app === BACKUP_APP && typeof candidate.format === 'number' && hasSettings
}

/**
 * Reads a backup file into the settings to apply. Anything that is not a backup of this app is refused; fields
 * missing (an older version) take the defaults, and the connection in the file, if any, is ignored.
 */
export function readBackup(text: string): SettingsPatch {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new AppError('backup.invalid')
    }
    if (!isBackup(parsed)) throw new AppError('backup.invalid')
    if (parsed.format > BACKUP_FORMAT) throw new AppError('backup.newer')
    return withoutConnection(withDefaults(parsed.settings as Partial<Settings>))
}
