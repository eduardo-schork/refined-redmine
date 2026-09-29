import { Notification } from 'electron'
import type { MonitorStateRepository, SettingsRepository } from '@application/ports/repositories'
import type { Clock, SystemNotifier } from '@application/ports/system'
import { shouldSummarize, type AppNotification } from '@domain/notification/notification'
import type { NotifyProbeResult } from '@domain/notification/permission'
import { systemNotificationText } from '@shared/i18n/format/notification'
import type { MainLocalization } from './main-localization'

const PROBE_TIMEOUT_MS = 8_000
const SUMMARY_PREVIEW_COUNT = 3

export interface NotifierHandlers {
    /** Click on a notification (or on the summary, when `item` is undefined). */
    onActivate(item?: AppNotification): void
    /** The system refused a notification (permission). */
    onFailure(): void
}

/** Native notifications, with text in the current language and delivery tracking. */
export class ElectronSystemNotifier implements SystemNotifier {
    constructor(
        private readonly localization: MainLocalization,
        private readonly settings: SettingsRepository,
        private readonly state: MonitorStateRepository,
        private readonly clock: Clock,
        private readonly handlers: NotifierHandlers
    ) {}

    private track(notification: Notification): void {
        notification.on('show', () => this.state.setDelivery({ ok: true, at: this.clock.now().toISOString() }))
        notification.on('failed', (_event, error) => {
            this.state.setDelivery({ ok: false, at: this.clock.now().toISOString(), detail: String(error || '') })
            this.handlers.onFailure()
        })
    }

    private display(notification: Notification, onClick: () => void): void {
        notification.on('click', onClick)
        this.track(notification)
        notification.show()
    }

    show(items: AppNotification[]): void {
        if (!items.length || !Notification.isSupported()) return
        const silent = !this.settings.get().sound
        if (shouldSummarize(items.length)) {
            this.showSummary(items, silent)
            return
        }
        this.showEach(items, silent)
    }

    private showSummary(items: AppNotification[], silent: boolean): void {
        const { t, dates } = this.localization
        const now = this.clock.now()
        const previewTitles = items
            .slice(0, SUMMARY_PREVIEW_COUNT)
            .map((item) => systemNotificationText(item, t, dates, now).title)
        const summary = new Notification({
            title: t('notification.summary', { count: items.length }),
            body: previewTitles.join('\n'),
            silent
        })
        this.display(summary, () => this.handlers.onActivate())
    }

    private showEach(items: AppNotification[], silent: boolean): void {
        const { t, dates } = this.localization
        const now = this.clock.now()
        for (const item of items) {
            const text = systemNotificationText(item, t, dates, now)
            const notification = new Notification({ title: text.title, body: text.body, silent })
            this.display(notification, () => this.handlers.onActivate(item))
        }
    }

    probe(): Promise<NotifyProbeResult> {
        if (!Notification.isSupported()) return Promise.resolve({ shown: false, reason: 'unsupported' })
        const { t } = this.localization
        return new Promise((resolve) => {
            const notification = new Notification({
                title: t('notification.test.title'),
                body: t('notification.test.body'),
                silent: !this.settings.get().sound
            })
            this.track(notification)
            const timer = setTimeout(() => resolve({ shown: false, reason: 'noAnswer' }), PROBE_TIMEOUT_MS)
            const settle = (result: NotifyProbeResult) => {
                clearTimeout(timer)
                resolve(result)
            }
            notification.once('show', () => settle({ shown: true }))
            notification.once('failed', (_event, error) => {
                settle({ shown: false, reason: 'refused', detail: String(error || '') })
            })
            notification.on('click', () => this.handlers.onActivate())
            notification.show()
        })
    }
}
