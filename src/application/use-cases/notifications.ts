import type { AppNotification } from '@domain/notification/notification'
import type { AppCopy, NotifyPermissionInfo, NotifyProbeResult } from '@domain/notification/permission'
import type { MonitorStateRepository, NotificationRepository } from '../ports/repositories'
import type { AppEventsPublisher, Clock, NotificationPermissionProbe, SystemNotifier } from '../ports/system'

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
        private readonly notifier: SystemNotifier,
        private readonly state: MonitorStateRepository,
        private readonly clock: Clock,
        private readonly appCopy: AppCopy
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

    /** The user says whether the test notification appeared: the only reliable proof that notifications work. */
    confirm(seen: boolean): Promise<NotifyPermissionInfo> {
        this.state.setConfirmation({ seen, at: this.clock.now().toISOString(), app: this.appCopy })
        return this.probe.check()
    }
}
