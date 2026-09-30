import type { AppInfo, SupportReport } from '../dto'
import type { ActivityLog } from '../ports/activity-log'
import type { SettingsRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'
import type { MonitorService } from '../services/monitor-service'
import type { NotificationPermissionService } from './notifications'

const RECENT_PROBLEMS = 15

export interface SupportDeps {
    settings: SettingsRepository
    monitor: MonitorService
    permission: NotificationPermissionService
    log: ActivityLog
    clock: Clock
    appInfo: () => AppInfo
    osDescription: () => string
}

function hostOf(baseUrl: string): string {
    try {
        return new URL(baseUrl).host
    } catch {
        return baseUrl
    }
}

/** Collects what helps to diagnose a problem reported by a user. */
export class BuildSupportReportUseCase {
    constructor(private readonly deps: SupportDeps) {}

    async execute(): Promise<SupportReport> {
        const settings = this.deps.settings.get()
        const problems = this.deps.log.list().filter((entry) => entry.level !== 'info')
        const monitors = settings.monitors.map((monitor) => ({
            id: monitor.id,
            name: monitor.name,
            enabled: monitor.enabled,
            source: monitor.source.type
        }))
        return {
            generatedAt: this.deps.clock.now().toISOString(),
            app: this.deps.appInfo(),
            os: this.deps.osDescription(),
            language: settings.language,
            redmineHost: hostOf(settings.baseUrl),
            userLogin: settings.user?.login,
            monitor: this.deps.monitor.getStatus(),
            permission: await this.deps.permission.check(),
            monitors,
            boardCount: settings.boards.length,
            recentProblems: problems.slice(0, RECENT_PROBLEMS)
        }
    }
}
