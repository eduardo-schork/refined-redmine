import type { CalendarEvent } from '@domain/calendar/calendar-event'
import { planDelete, planSave, type EditContext } from '@domain/calendar/event-editing'
import { findDueReminders, FIRED_TTL_MS, type DueReminder } from '@domain/calendar/reminders'
import { calendarRoute, type AppNotification } from '@domain/notification/notification'
import { toLocalDateTime } from '@domain/shared/date'
import { AppError } from '@domain/shared/errors'
import type { DeleteEventCommand, SaveEventCommand } from '../dto'
import type { CalendarRepository, NotificationRepository, SettingsRepository } from '../ports/repositories'
import type { AppEventsPublisher, Cancel, Clock, IdGenerator, Scheduler, SystemNotifier } from '../ports/system'

export class ListCalendarEventsUseCase {
    constructor(private readonly repo: CalendarRepository) {}

    execute(): CalendarEvent[] {
        return this.repo.list()
    }
}

function isValidIssueId(issueId: number | undefined): boolean {
    if (issueId === undefined) return true
    return Number.isInteger(issueId) && issueId > 0
}

/** Saves an event; for series, applies the edit scope (this / this and following / all). */
export class SaveCalendarEventUseCase {
    constructor(
        private readonly repo: CalendarRepository,
        private readonly ids: IdGenerator,
        private readonly clock: Clock
    ) {}

    execute(command: SaveEventCommand): CalendarEvent[] {
        const title = command.draft.title.trim()
        if (!title) throw new AppError('calendar.titleRequired')
        if (!isValidIssueId(command.draft.issueId)) throw new AppError('calendar.invalidIssue')

        const context: EditContext = { newId: () => this.ids.next(), nowIso: this.clock.now().toISOString() }
        const draft = {
            ...command.draft,
            title,
            id: command.isNew ? context.newId() : command.draft.id,
            createdAt: command.isNew ? context.nowIso : command.draft.createdAt
        }
        const original = this.findOriginal(command.originalId)
        const change = planSave(original, draft, command.occurrenceKey, command.scope, context)
        return this.repo.apply(change)
    }

    private findOriginal(originalId: string | undefined): CalendarEvent | undefined {
        if (!originalId) return undefined
        return this.repo.list().find((event) => event.id === originalId)
    }
}

export class DeleteCalendarEventUseCase {
    constructor(
        private readonly repo: CalendarRepository,
        private readonly clock: Clock
    ) {}

    execute(command: DeleteEventCommand): CalendarEvent[] {
        const original = this.repo.list().find((event) => event.id === command.eventId)
        if (!original) return this.repo.list()
        const nowIso = this.clock.now().toISOString()
        const change = planDelete(original, command.occurrenceKey, command.scope, nowIso)
        return this.repo.apply(change)
    }
}

const REMINDER_TICK_MS = 20_000

/** Fires calendar reminders from the main process, so they work even with the window closed. */
export class ReminderDispatcher {
    private cancel: Cancel | null = null

    constructor(
        private readonly deps: {
            calendar: CalendarRepository
            settings: SettingsRepository
            notifications: NotificationRepository
            notifier: SystemNotifier
            events: AppEventsPublisher
            clock: Clock
            ids: IdGenerator
            scheduler: Scheduler
        }
    ) {}

    start(): void {
        this.tick()
        this.cancel = this.deps.scheduler.every(REMINDER_TICK_MS, () => this.tick())
    }

    stop(): void {
        this.cancel?.()
    }

    tick(): AppNotification[] {
        const { calendar } = this.deps
        const now = this.deps.clock.now()
        const settings = this.deps.settings.get()
        const due = findDueReminders(calendar.list(), now, settings.calendar, (key) => calendar.wasFired(key))

        const pruneBefore = new Date(now.getTime() - FIRED_TTL_MS)
        calendar.pruneFired(pruneBefore.toISOString())
        if (!due.length) return []

        const dueKeys = due.map((reminder) => reminder.key)
        calendar.markFired(dueKeys, now.toISOString())

        const items = due.map((reminder) => this.toNotification(reminder, now))
        this.deps.notifier.show(items)
        if (settings.reminderHistory) {
            this.deps.notifications.add(items)
            this.deps.events.notificationsChanged(this.deps.notifications.list())
        }
        return items
    }

    private toNotification({ occurrence, minutes }: DueReminder, now: Date): AppNotification {
        const { event } = occurrence
        return {
            id: this.deps.ids.next(),
            kind: 'reminder',
            payload: {
                type: 'reminder',
                eventId: event.id,
                occurrenceKey: occurrence.key,
                title: event.title,
                start: toLocalDateTime(occurrence.start),
                end: toLocalDateTime(occurrence.end),
                allDay: event.allDay,
                location: event.location,
                minutes
            },
            target: { type: 'route', route: calendarRoute(occurrence.key, event.id) },
            createdAt: now.toISOString(),
            read: false
        }
    }
}
