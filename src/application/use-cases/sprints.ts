import { toLocalDate } from '@domain/shared/date'
import { classifySprints, detectDateFields } from '@domain/sprint/sprint-classifier'
import type { VersionStats } from '@domain/sprint/sprint'
import type { ProjectInspection, SprintList } from '../dto'
import type { RedmineGateway } from '../ports/redmine-gateway'
import type { SettingsRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

export class ListSprintsUseCase {
    constructor(
        private readonly gateway: RedmineGateway,
        private readonly settings: SettingsRepository,
        private readonly clock: Clock
    ) {}

    async execute(): Promise<SprintList> {
        const conventions = this.settings.get().sprints
        if (!conventions.projectId) return { configured: false, all: [] }
        const versions = await this.gateway.listVersions(conventions.projectId)
        const today = toLocalDate(this.clock.now())
        return { configured: true, all: classifySprints(versions, conventions, today) }
    }
}

export class GetVersionStatsUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    async execute(versionId: number): Promise<VersionStats> {
        const [total, open, mineOpen] = await Promise.all([
            this.gateway.countIssues({ versionId, status: '*' }),
            this.gateway.countIssues({ versionId, status: 'open' }),
            this.gateway.countIssues({ versionId, status: 'open', assignedTo: 'me' })
        ])
        return { total, open, mineOpen }
    }
}

/** First access to sprints: suggests the date fields of the chosen project. */
export class InspectSprintProjectUseCase {
    constructor(private readonly gateway: RedmineGateway) {}

    async execute(projectId: number): Promise<ProjectInspection> {
        const versions = await this.gateway.listVersions(projectId)
        return { ...detectDateFields(versions), versionCount: versions.length }
    }
}
