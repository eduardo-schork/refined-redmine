import type { RedmineUser } from '@domain/redmine/entities'
import { isWellFormedSecret } from '@domain/shared/secrets'
import { loginErrorCode, prepareBaseUrl } from '@domain/redmine/connection'
import { isHttpUrl } from '@domain/redmine/links'
import { AppError } from '@domain/shared/errors'
import type { SettingsView } from '../dto'
import type { RedmineGateway } from '../ports/redmine-gateway'
import type {
    MonitorStateRepository,
    NotificationRepository,
    SecretStore,
    SettingsRepository
} from '../ports/repositories'
import type { AppEventsPublisher } from '../ports/system'
import type { MonitorService } from '../services/monitor-service'

export function toView(settings: SettingsRepository, secrets: SecretStore): SettingsView {
    return { ...settings.get(), hasApiKey: secrets.hasApiKey() }
}

export class GetSessionUseCase {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly secrets: SecretStore
    ) {}

    execute(): SettingsView {
        return toView(this.settings, this.secrets)
    }
}

/** Connects to a Redmine: validates the URL and API key against /my/account and stores the session. */
export class LoginUseCase {
    constructor(
        private readonly gateway: RedmineGateway,
        private readonly settings: SettingsRepository,
        private readonly secrets: SecretStore,
        private readonly monitor: MonitorService
    ) {}

    async execute(rawUrl: string, rawKey: string): Promise<SettingsView> {
        const baseUrl = prepareBaseUrl(rawUrl)
        const apiKey = rawKey.trim()
        if (!isHttpUrl(baseUrl)) throw new AppError('auth.invalidUrl')
        if (!isWellFormedSecret(apiKey)) throw new AppError('auth.invalidKey')
        const user = await this.fetchUser(baseUrl, apiKey)
        const { id, login, firstname, lastname, mail } = user
        const sessionUser = { id, login, firstname, lastname, mail }
        this.secrets.saveApiKey(apiKey)
        this.settings.save({ ...this.settings.get(), baseUrl, user: sessionUser })
        this.monitor.start()
        return toView(this.settings, this.secrets)
    }

    private async fetchUser(baseUrl: string, apiKey: string): Promise<RedmineUser> {
        try {
            return await this.gateway.currentUser({ baseUrl, apiKey })
        } catch (error) {
            if (!(error instanceof AppError)) throw error
            const code = loginErrorCode(error.code)
            if (code === error.code) throw error
            throw new AppError(code, error.params, error.status)
        }
    }
}

/** Disconnects: removes the key and the user, resets the monitor state and the history. Keeps boards and preferences. */
export class LogoutUseCase {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly secrets: SecretStore,
        private readonly state: MonitorStateRepository,
        private readonly notifications: NotificationRepository,
        private readonly monitor: MonitorService,
        private readonly events: AppEventsPublisher
    ) {}

    execute(): SettingsView {
        this.monitor.stop()
        this.secrets.clear()
        this.settings.save({ ...this.settings.get(), user: undefined })
        this.state.reset()
        this.notifications.clear()
        this.events.notificationsChanged([])
        return toView(this.settings, this.secrets)
    }
}
