import type { AppNotification } from '@domain/notification/notification'
import type { NotifyPermissionInfo, NotifyProbeResult } from '@domain/notification/permission'
import type { NotificationRepository } from '../ports/repositories'
import type { AppEventsPublisher, NotificationPermissionProbe, SystemNotifier } from '../ports/system'

export class NotificationFeed {
    constructor(
        private readonly repo: NotificationRepository,
        private readonly events: AppEventsPublisher
    ) {}

    list(): AppNotification[] {
        return this.repo.list()
    }

    markRead(ids: string[] | 'all'): AppNotification[] {
        const items = this.repo.markRead(ids)
        this.events.notificationsChanged(items)
        return items
    }

    clear(): AppNotification[] {
        this.repo.clear()
        this.events.notificationsChanged([])
        return []
    }
}

export class NotificationPermissionService {
    constructor(
        private readonly probe: NotificationPermissionProbe,
        private readonly notifier: SystemNotifier
    ) {}

    check(): Promise<NotifyPermissionInfo> {
        return this.probe.check()
    }

    openSettings(): Promise<void> {
        return this.probe.openSettings()
    }

    sendTest(): Promise<NotifyProbeResult> {
        return this.notifier.probe()
    }
}
