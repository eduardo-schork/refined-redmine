import { app, net, shell } from 'electron'
import { join } from 'node:path'
import type { AppEventsPublisher } from '@application/ports/system'
import { MonitorService } from '@application/services/monitor-service'
import {
    BoardFilterResolver,
    DeleteBoardUseCase,
    ListBoardIssuesUseCase,
    MoveIssueToColumnUseCase,
    SaveBoardUseCase
} from '@application/use-cases/boards'
import {
    DeleteCalendarEventUseCase,
    ListCalendarEventsUseCase,
    ReminderDispatcher,
    SaveCalendarEventUseCase
} from '@application/use-cases/calendar'
import {
    ChangeIssueStatusUseCase,
    CommentOnIssueUseCase,
    IssueQueries,
    ReferenceDataQueries
} from '@application/use-cases/issues'
import { NotificationFeed, NotificationPermissionService } from '@application/use-cases/notifications'
import { GetSessionUseCase, LoginUseCase, LogoutUseCase } from '@application/use-cases/session'
import { UpdateSettingsUseCase } from '@application/use-cases/settings'
import { GetVersionStatsUseCase, InspectSprintProjectUseCase, ListSprintsUseCase } from '@application/use-cases/sprints'
import type { AppNotification } from '@domain/notification/notification'
import { electronLoginItem } from '@infra/electron/login-item'
import { ElectronSystemNotifier } from '@infra/electron/electron-notifier'
import { MainLocalization } from '@infra/electron/main-localization'
import { ElectronNativeTheme } from '@infra/electron/native-theme'
import { DesktopNotificationPermission } from '@infra/electron/notification-permission'
import { SafeStorageSecretStore } from '@infra/electron/safe-storage-secret-store'
import { ActivityLogFile } from '@infra/persistence/activity-log-file'
import type { CalendarFile, ConfigFile, StateFile } from '@infra/persistence/files'
import { JsonFile } from '@infra/persistence/json-file'
import {
    JsonCalendarRepository,
    JsonMonitorStateRepository,
    JsonNotificationRepository,
    JsonSettingsRepository
} from '@infra/persistence/repositories'
import { RedmineHttpClient } from '@infra/redmine/http-client'
import { HttpRedmineGateway } from '@infra/redmine/http-redmine-gateway'
import { systemClock, timerScheduler, uuidGenerator } from '@infra/system/system'
import type { ApiHandlers } from './ipc-router'
import { openExternal } from './window'

export interface Presentation {
    publisher: AppEventsPublisher
    showWindow(route?: string): void
}

function openNotificationTarget(item: AppNotification, presentation: Presentation): void {
    if (item.target.type === 'route') {
        presentation.showWindow(item.target.route)
        return
    }
    void openExternal(item.target.url)
}

export function createContainer(presentation: () => Presentation) {
    const userDataDir = app.getPath('userData')
    const configFile = new JsonFile<ConfigFile>(join(userDataDir, 'config.json'), () => ({}))
    const stateFile = new JsonFile<StateFile>(join(userDataDir, 'state.json'), () => ({
        events: [],
        querySnapshots: {}
    }))
    const calendarFile = new JsonFile<CalendarFile>(join(userDataDir, 'calendar.json'), () => ({
        version: 1,
        events: [],
        fired: {}
    }))

    const settings = new JsonSettingsRepository(configFile)
    const secrets = new SafeStorageSecretStore(configFile)
    const state = new JsonMonitorStateRepository(stateFile)
    const notificationsRepo = new JsonNotificationRepository(stateFile)
    const calendarRepo = new JsonCalendarRepository(calendarFile)

    const activityLog = new ActivityLogFile(join(userDataDir, 'logs', 'activity.log'), systemClock)

    const http = new RedmineHttpClient(
        (url, init) => net.fetch(url, init),
        () => {
            const apiKey = secrets.getApiKey()
            const { baseUrl } = settings.get()
            if (!apiKey || !baseUrl) return null
            return { baseUrl, apiKey }
        },
        undefined,
        (request) => activityLog.write({ type: 'http', ...request })
    )
    const gateway = new HttpRedmineGateway(http)
    const localization = new MainLocalization(settings.get().language, () => app.getLocale())
    const theme = new ElectronNativeTheme()
    theme.setThemeMode(settings.get().appearance.theme)
    const publisher: AppEventsPublisher = {
        notificationsChanged: (items) => presentation().publisher.notificationsChanged(items),
        monitorStatusChanged: (status) => presentation().publisher.monitorStatusChanged(status),
        permissionChanged: (info) => presentation().publisher.permissionChanged(info)
    }

    const permissionProbe = new DesktopNotificationPermission(state)
    const feed = new NotificationFeed(notificationsRepo, publisher)
    const notifier = new ElectronSystemNotifier(localization, settings, state, systemClock, {
        onActivate: (item?: AppNotification) => {
            if (!item) {
                presentation().showWindow('/notifications')
                return
            }
            feed.markRead([item.id])
            openNotificationTarget(item, presentation())
        },
        onFailure: () => {
            void permissionProbe.check().then((info) => publisher.permissionChanged(info))
        }
    })

    const scheduler = timerScheduler
    const clock = systemClock
    const ids = uuidGenerator
    const listSprints = new ListSprintsUseCase(gateway, settings, clock)
    const boardFilter = new BoardFilterResolver(listSprints)
    const monitor = new MonitorService({
        gateway,
        settings,
        secrets,
        state,
        notifications: notificationsRepo,
        notifier,
        events: publisher,
        clock,
        ids,
        scheduler,
        log: activityLog,
        boardFilter
    })
    const reminders = new ReminderDispatcher({
        calendar: calendarRepo,
        settings,
        notifications: notificationsRepo,
        notifier,
        events: publisher,
        clock,
        ids,
        scheduler
    })

    const session = new GetSessionUseCase(settings, secrets)
    const login = new LoginUseCase(gateway, settings, secrets, monitor)
    const logout = new LogoutUseCase(settings, secrets, state, notificationsRepo, monitor, publisher)
    const updateSettings = new UpdateSettingsUseCase(settings, secrets, monitor, electronLoginItem, localization, theme)
    const issues = new IssueQueries(gateway)
    const reference = new ReferenceDataQueries(gateway)
    const changeStatus = new ChangeIssueStatusUseCase(gateway)
    const comment = new CommentOnIssueUseCase(gateway)
    const versionStats = new GetVersionStatsUseCase(gateway)
    const inspectProject = new InspectSprintProjectUseCase(gateway)
    const boardIssues = new ListBoardIssuesUseCase(gateway, settings, boardFilter)
    const restartMonitor = () => monitor.start()
    const saveBoard = new SaveBoardUseCase(settings, secrets, restartMonitor)
    const deleteBoard = new DeleteBoardUseCase(settings, secrets, restartMonitor)
    const moveIssue = new MoveIssueToColumnUseCase(gateway, settings)
    const listEvents = new ListCalendarEventsUseCase(calendarRepo)
    const saveEvent = new SaveCalendarEventUseCase(calendarRepo, ids, clock)
    const deleteEvent = new DeleteCalendarEventUseCase(calendarRepo, clock)
    const permission = new NotificationPermissionService(permissionProbe, notifier)

    const api: ApiHandlers = {
        session: {
            get: () => session.execute(),
            login: (baseUrl, apiKey) => {
                reference.invalidate()
                return login.execute(baseUrl, apiKey)
            },
            logout: () => logout.execute()
        },
        settings: { update: (patch) => updateSettings.execute(patch) },
        issues: {
            list: (filter, max) => issues.list(filter, max),
            get: (id) => issues.get(id),
            allowedStatuses: (id) => issues.allowedStatuses(id),
            changeStatus: (id, statusId) => changeStatus.execute(id, statusId),
            comment: (id, notes) => comment.execute(id, notes)
        },
        reference: {
            statuses: () => reference.statuses(),
            projects: () => reference.projects(),
            savedQueries: () => reference.savedQueries()
        },
        boards: {
            issues: (boardId) => boardIssues.execute(boardId),
            save: (board, notifications) => saveBoard.execute(board, notifications),
            remove: (boardId) => deleteBoard.execute(boardId),
            move: (boardId, issueId, columnId) => moveIssue.execute(boardId, issueId, columnId)
        },
        sprints: {
            list: () => listSprints.execute(),
            stats: (versionId) => versionStats.execute(versionId),
            inspectProject: (projectId) => inspectProject.execute(projectId)
        },
        calendar: {
            list: () => listEvents.execute(),
            save: (command) => saveEvent.execute(command),
            remove: (command) => deleteEvent.execute(command)
        },
        notifications: {
            list: () => feed.list(),
            markRead: (ids) => feed.markRead(ids),
            clear: () => feed.clear(),
            test: () => permission.sendTest(),
            permission: () => permission.check(),
            openSettings: () => permission.openSettings()
        },
        monitor: {
            status: () => monitor.getStatus(),
            runNow: () => monitor.runNow()
        },
        log: {
            list: () => activityLog.list(),
            clear: () => activityLog.clear()
        },
        app: {
            openExternal: (url) => openExternal(url),
            info: () => ({
                version: app.getVersion(),
                electron: process.versions.electron,
                platform: process.platform,
                arch: process.arch,
                dataPath: userDataDir
            }),
            openDataFolder: () => void shell.openPath(userDataDir)
        }
    }

    return { api, monitor, reminders, localization, feed }
}
