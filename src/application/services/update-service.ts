import { AppError, serializeError } from '@domain/shared/errors'
import { isWellFormedSecret } from '@domain/shared/secrets'
import { installerFor, isNewerVersion, type Release, type UpdateStatus } from '@domain/update/release'
import type { SettingsRepository } from '../ports/repositories'
import type { AppEventsPublisher, Cancel, Clock, Scheduler } from '../ports/system'
import type { Installer, ReleaseSource, UpdateTokenStore } from '../ports/updates'

// The first check waits for the app to settle; afterwards the interval chosen in the settings (1 day by default).
const FIRST_CHECK_DELAY_MS = 30_000
const HOUR_MS = 60 * 60 * 1000
const PROGRESS_STEP = 0.02

export interface UpdateDeps {
    source: ReleaseSource
    tokens: UpdateTokenStore
    installer: Installer
    settings: SettingsRepository
    events: AppEventsPublisher
    clock: Clock
    scheduler: Scheduler
    currentVersion: string
    platform: string
    arch: string
}

/**
 * Update check against the releases published on the app's public repository. No token is needed; a personal one
 * only raises GitHub's limit of unauthenticated checks (60 per hour per network address).
 */
export class UpdateService {
    private status: UpdateStatus
    private cancelTimers: Cancel[] = []

    constructor(private readonly deps: UpdateDeps) {
        const hasToken = deps.tokens.get() !== null
        this.status = { phase: 'idle', currentVersion: deps.currentVersion, hasToken }
    }

    getStatus(): UpdateStatus {
        return this.status
    }

    start(): void {
        this.stop()
        const { autoCheck, intervalHours } = this.deps.settings.get().updates
        if (!autoCheck) return
        const check = () => void this.check()
        this.cancelTimers = [
            this.deps.scheduler.after(FIRST_CHECK_DELAY_MS, check),
            this.deps.scheduler.every(intervalHours * HOUR_MS, check)
        ]
    }

    stop(): void {
        for (const cancel of this.cancelTimers) cancel()
        this.cancelTimers = []
    }

    async check(): Promise<UpdateStatus> {
        const token = this.deps.tokens.get()
        const busy = this.status.phase === 'checking' || this.status.phase === 'downloading'
        if (busy) return this.status

        const downloadedVersion = this.status.installerPath ? this.status.latest?.version : undefined
        this.update({ phase: 'checking', error: undefined })
        try {
            const release = await this.deps.source.latest(token)
            const alreadyDownloaded = release !== null && release.version === downloadedVersion
            if (alreadyDownloaded) return this.update({ phase: 'ready', checkedAt: this.now() })
            const found = { latest: release ?? undefined, installerPath: undefined, checkedAt: this.now() }
            return this.update({ ...this.phaseFor(release), ...found })
        } catch (error) {
            return this.update({ phase: 'error', error: serializeError(error), checkedAt: this.now() })
        }
    }

    /** Checks a token before saving it; returns the latest published version it can see. */
    async testToken(token: string): Promise<{ latestVersion?: string }> {
        const cleanToken = token.trim()
        if (!isWellFormedSecret(cleanToken)) throw new AppError('update.unauthorized')
        const release = await this.deps.source.latest(cleanToken)
        return { latestVersion: release?.version }
    }

    setToken(token: string | null): Promise<UpdateStatus> {
        const cleanToken = token?.trim()
        if (cleanToken && !isWellFormedSecret(cleanToken)) return Promise.reject(new AppError('update.unauthorized'))
        if (cleanToken) this.deps.tokens.save(cleanToken)
        else this.deps.tokens.clear()
        this.update({ hasToken: Boolean(cleanToken), installerPath: undefined })
        return this.check()
    }

    async download(): Promise<UpdateStatus> {
        const token = this.deps.tokens.get()
        const release = this.status.latest
        if (!release || this.status.phase !== 'available') return this.status

        const asset = installerFor(release, this.deps.platform, this.deps.arch)
        if (!asset) {
            const error = serializeError(new AppError('update.noInstaller', { version: release.version }))
            return this.update({ phase: 'error', error })
        }

        this.update({ phase: 'downloading', progress: 0, error: undefined })
        try {
            const installerPath = await this.deps.source.download(asset, token, (fraction) => this.progress(fraction))
            return this.update({ phase: 'ready', progress: 1, installerPath })
        } catch (error) {
            return this.update({ phase: 'available', progress: undefined, error: serializeError(error) })
        }
    }

    async install(): Promise<void> {
        const installerPath = this.status.installerPath
        if (this.status.phase !== 'ready' || !installerPath) return
        await this.deps.installer.open(installerPath)
    }

    private phaseFor(release: Release | null): Pick<UpdateStatus, 'phase'> {
        const hasNewer = release !== null && isNewerVersion(release.version, this.deps.currentVersion)
        return { phase: hasNewer ? 'available' : 'upToDate' }
    }

    /** Progress events are throttled: one every 2%. */
    private progress(fraction: number): void {
        const previous = this.status.progress ?? 0
        const advancedEnough = fraction - previous >= PROGRESS_STEP
        if (advancedEnough) this.update({ progress: fraction })
    }

    private update(patch: Partial<UpdateStatus>): UpdateStatus {
        this.status = { ...this.status, ...patch }
        this.deps.events.updateStatusChanged(this.status)
        return this.status
    }

    private now(): string {
        return this.deps.clock.now().toISOString()
    }
}
