import { MAX_BACKUP_BYTES, readBackup, settingsBackup } from '@domain/settings/backup'
import { toLocalDate } from '@domain/shared/date'
import type { SettingsView } from '../dto'
import type { SettingsRepository } from '../ports/repositories'
import type { Clock, FileDialogs } from '../ports/system'
import type { UpdateSettingsUseCase } from './settings'

/** Settings → JSON file and back (Settings → Backup). Importing goes through the same checks as any settings change. */
export class BackupUseCases {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly files: FileDialogs,
        private readonly updateSettings: UpdateSettingsUseCase,
        private readonly clock: Clock
    ) {}

    exportToFile(): Promise<boolean> {
        const now = this.clock.now()
        const text = JSON.stringify(settingsBackup(this.settings.get(), now), null, 2)
        return this.files.saveText(`refined-redmine-settings-${toLocalDate(now)}.json`, text)
    }

    async importFromFile(): Promise<SettingsView | null> {
        const text = await this.files.openText(MAX_BACKUP_BYTES)
        if (text === null) return null
        return this.updateSettings.execute(readBackup(text))
    }
}
