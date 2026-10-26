import { CommentAndChangeUseCase, findNearbyIssues } from '@application/use-cases/handoff'
import { OvertimeUseCases } from '@application/use-cases/overtime'
import { BulkEditUseCase, loadIssueTree } from '@application/use-cases/issue-tree'
import { app, dialog, net, shell } from 'electron'
import { release, type as osType } from 'node:os'
import { join } from 'node:path'
import type { AppEventsPublisher } from '@application/ports/system'
import { MonitorService } from '@application/services/monitor-service'
import { UpdateService } from '@application/services/update-service'
import {
    BoardFilterResolver,
    DeleteBoardUseCase,
    ListBoardIssuesUseCase,
    MoveIssueToColumnUseCase,
    SaveBoardUseCase,
    SuggestBoardColumnsUseCase
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
    CreateIssueUseCase,
    EditIssueFieldsUseCase,
    IssueQueries,
    ReferenceDataQueries
} from '@application/use-cases/issues'
import { NotificationFeed, NotificationPermissionService } from '@application/use-cases/notifications'
import { GetSessionUseCase, LoginUseCase, LogoutUseCase } from '@application/use-cases/session'
import { UpdateSettingsUseCase } from '@application/use-cases/settings'
import { BuildSupportReportUseCase } from '@application/use-cases/support'
import { GetVersionStatsUseCase, InspectSprintProjectUseCase, ListSprintsUseCase } from '@application/use-cases/sprints'
import { issueRoute, type AppNotification } from '@domain/notification/notification'
import type { AppCopy } from '@domain/notification/permission'
import { electronLoginItem } from '@infra/electron/login-item'
import { ElectronSystemNotifier } from '@infra/electron/electron-notifier'
import { MainLocalization } from '@infra/electron/main-localization'
import { ElectronNativeTheme } from '@infra/electron/native-theme'
import { DesktopNotificationPermission } from '@infra/electron/notification-permission'
import { SafeStorageSecretStore } from '@infra/electron/safe-storage-secret-store'
import { DesktopInstaller } from '@infra/electron/installer'
import { SafeStorageUpdateTokenStore } from '@infra/electron/update-token-store'
import { GithubReleaseSource } from '@infra/github/github-releases'
import { ActivityLogFile } from '@infra/persistence/activity-log-file'
import type { CalendarFile, ConfigFile, OvertimeFile, StateFile } from '@infra/persistence/files'
import { JsonFile } from '@infra/persistence/json-file'
import {
    JsonCalendarRepository,
    JsonOvertimeRepository,
    JsonMonitorStateRepository,
    JsonNotificationRepository,
    JsonSettingsRepository,
    JsonTimerRepository
} from '@infra/persistence/repositories'
import { TempFileOpener } from '@infra/electron/temp-file-opener'
import { electronLauncher } from '@infra/electron/external-launcher'
import { electronFileDialogs } from '@infra/electron/file-dialogs'
import { BackupUseCases } from '@application/use-cases/backup'
import { OpenClaudeActionUseCase } from '@application/use-cases/claude'
import { RedmineHttpClient } from '@infra/redmine/http-client'
import { HttpRedmineGateway } from '@infra/redmine/http-redmine-gateway'
import { systemClock, timerScheduler, uuidGenerator } from '@infra/system/system'
import type { ApiHandlers } from './ipc-router'
import { openExternal } from './window'
import { TimerService } from '@application/services/timer-service'
import {
    DeleteTimeEntryUseCase,
    EditTimeEntryUseCase,
    LogTimeUseCase,
    RepeatWeekUseCase,
    TimeQueries
} from '@application/use-cases/time'
import { AttachmentUseCases } from '@application/use-cases/attachments'
import { electronIdleProbe } from '@infra/electron/idle-probe'

export interface Presentation {
    publisher: AppEventsPublisher
    showWindow(route?: string): void
    quitApp(): void
}

/** A notification about an issue opens it in the app; the target URL is only for the ones without an issue. */
function openNotificationTarget(item: AppNotification, presentation: Presentation): void {
    if (item.issueId) {
        presentation.showWindow(issueRoute(item.issueId))
        return
    }
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
    const overtimeFile = new JsonFile<OvertimeFile>(join(userDataDir, 'overtime.json'), () => ({
        version: 1,
        entries: [],
        paidMonths: []
    }))

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
        permissionChanged: (info) => presentation().publisher.permissionChanged(info),
        updateStatusChanged: (status) => presentation().publisher.updateStatusChanged(status),
        timerChanged: (timer) => presentation().publisher.timerChanged(timer)
    }

    // The dev build and the installed app share this folder but are different apps for the operating system.
    const appCopy: AppCopy = app.isPackaged ? 'installed' : 'dev'
    const permissionProbe = new DesktopNotificationPermission(state, appCopy)
    const feed = new NotificationFeed(notificationsRepo, publisher)
    const notifier = new ElectronSystemNotifier(
        localization,
        settings,
        state,
        systemClock,
        {
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
        },
        appCopy
    )

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
    const issues = new IssueQueries(gateway)
    const reference = new ReferenceDataQueries(gateway)
    const changeStatus = new ChangeIssueStatusUseCase(gateway)
    const comment = new CommentOnIssueUseCase(gateway)
    const editIssue = new EditIssueFieldsUseCase(gateway)
    const bulkEdit = new BulkEditUseCase(gateway)
    const commentAndChange = new CommentAndChangeUseCase(gateway)
    const overtime = new OvertimeUseCases(new JsonOvertimeRepository(overtimeFile), ids)
    const createIssue = new CreateIssueUseCase(gateway)
    const versionStats = new GetVersionStatsUseCase(gateway)
    const inspectProject = new InspectSprintProjectUseCase(gateway)
    const boardIssues = new ListBoardIssuesUseCase(gateway, settings, boardFilter)
    const suggestColumns = new SuggestBoardColumnsUseCase(gateway, boardFilter)
    const restartMonitor = () => monitor.start()
    const saveBoard = new SaveBoardUseCase(settings, secrets, restartMonitor)
    const deleteBoard = new DeleteBoardUseCase(settings, secrets, restartMonitor)
    const moveIssue = new MoveIssueToColumnUseCase(gateway, settings)
    const listEvents = new ListCalendarEventsUseCase(calendarRepo)
    const saveEvent = new SaveCalendarEventUseCase(calendarRepo, ids, clock)
    const deleteEvent = new DeleteCalendarEventUseCase(calendarRepo, clock)
    const permission = new NotificationPermissionService(permissionProbe, notifier, state, systemClock, appCopy)
    const timeQueries = new TimeQueries(gateway)
    const fileOpener = new TempFileOpener()
    const attachments = new AttachmentUseCases(gateway, fileOpener)
    const logTime = new LogTimeUseCase(gateway)
    const editTime = new EditTimeEntryUseCase(gateway)
    const deleteTime = new DeleteTimeEntryUseCase(gateway)
    const repeatWeek = new RepeatWeekUseCase(gateway)
    const timer = new TimerService({
        repository: new JsonTimerRepository(stateFile),
        events: publisher,
        clock,
        scheduler,
        idle: electronIdleProbe
    })

    const appInfo = () => ({
        version: app.getVersion(),
        electron: process.versions.electron,
        platform: process.platform,
        arch: process.arch,
        dataPath: userDataDir
    })
    const updates = new UpdateService({
        source: new GithubReleaseSource(
            () => app.getPath('downloads'),
            (request) => activityLog.write({ type: 'http', ...request })
        ),
        tokens: new SafeStorageUpdateTokenStore(configFile),
        installer: new DesktopInstaller(() => presentation().quitApp()),
        settings,
        events: publisher,
        clock,
        scheduler,
        currentVersion: app.getVersion(),
        platform: process.platform,
        arch: process.arch
    })

    const updateSettings = new UpdateSettingsUseCase(
        settings,
        secrets,
        monitor,
        electronLoginItem,
        localization,
        theme,
        updates
    )

    const supportReport = new BuildSupportReportUseCase({
        settings,
        monitor,
        permission,
        log: activityLog,
        clock,
        appInfo,
        osDescription: () => `${osType()} ${release()}`
    })

    const openClaude = new OpenClaudeActionUseCase(settings, electronLauncher)
    const backup = new BackupUseCases(settings, electronFileDialogs, updateSettings, clock)

    const api: ApiHandlers = {
        session: {
            get: () => session.execute(),
            login: (baseUrl, apiKey) => {
                reference.invalidate()
                return login.execute(baseUrl, apiKey)
            },
            logout: () => logout.execute()
        },
        settings: {
            update: (patch) => updateSettings.execute(patch),
            exportBackup: () => backup.exportToFile(),
            importBackup: () => backup.importFromFile()
        },
        issues: {
            list: (filter, max) => issues.list(filter, max),
            get: (id) => issues.get(id),
            allowedStatuses: (id) => issues.allowedStatuses(id),
            byIds: (ids) => issues.byIds(ids),
            changeStatus: (id, statusId) => changeStatus.execute(id, statusId),
            comment: (id, notes) => comment.execute(id, notes),
            search: (input) => issues.search(input),
            edit: (id, change) => editIssue.execute(id, change),
            tree: (id) => loadIssueTree(gateway, id),
            bulkEdit: (id, change) => bulkEdit.execute(id, change),
            nearby: (id, trackerIds) => findNearbyIssues(gateway, id, trackerIds),
            commentAndChange: (id, change, uploads) => commentAndChange.execute(id, change, uploads),
            editOptions: (projectId) => issues.editOptions(projectId),
            customFields: (projectId) => issues.customFields(projectId),
            create: (issue, uploads) => createIssue.execute(issue, uploads)
        },
        reference: {
            statuses: () => reference.statuses(),
            projects: () => reference.projects(),
            savedQueries: () => reference.savedQueries(),
            priorities: () => reference.priorities(),
            trackers: () => reference.trackers(),
            timeActivities: () => reference.timeActivities()
        },
        time: {
            forIssue: (issueId) => timeQueries.forIssue(issueId),
            mine: (from, to) => timeQueries.mine(from, to),
            team: (memberIds, from, to) => timeQueries.team(memberIds, from, to),
            log: (draft) => logTime.execute(draft),
            edit: (id, draft) => editTime.execute(id, draft),
            remove: (id) => deleteTime.execute(id),
            repeatWeek: (from, to) => repeatWeek.execute(from, to)
        },
        overtime: {
            list: () => overtime.list(),
            add: (draft) => overtime.add(draft),
            update: (id, draft) => overtime.update(id, draft),
            remove: (id) => overtime.remove(id),
            setPaid: (month, paid) => overtime.setPaid(month, paid)
        },
        attachments: {
            preview: (id) => attachments.preview(id),
            open: (id) => attachments.open(id)
        },
        timer: {
            status: () => timer.status(),
            start: (issue) => timer.begin(issue),
            pause: () => timer.pause(),
            resume: () => timer.resume(),
            stop: () => timer.stop(),
            discard: () => timer.discard()
        },
        boards: {
            issues: (boardId) => boardIssues.execute(boardId),
            save: (board, notifications) => saveBoard.execute(board, notifications),
            remove: (boardId) => deleteBoard.execute(boardId),
            move: (boardId, issueId, columnId) => moveIssue.execute(boardId, issueId, columnId),
            suggestColumns: (board) => suggestColumns.execute(board)
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
            markUnread: (ids) => feed.markUnread(ids),
            remove: (ids) => feed.remove(ids),
            clear: () => feed.clear(),
            test: () => permission.sendTest(),
            confirm: (seen) => permission.confirm(seen),
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
        updates: {
            status: () => updates.getStatus(),
            check: () => updates.check(),
            setToken: (token) => updates.setToken(token),
            testToken: (token) => updates.testToken(token),
            download: () => updates.download(),
            install: () => updates.install()
        },
        app: {
            openExternal: (url) => openExternal(url),
            info: () => appInfo(),
            openDataFolder: () => void shell.openPath(userDataDir),
            supportReport: () => supportReport.execute(),
            pickFolder: async () => {
                const picked = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
                return picked.canceled ? null : (picked.filePaths[0] ?? null)
            }
        },
        claude: {
            open: (actionId, issue) => openClaude.execute(actionId, issue)
        }
    }

    return { api, monitor, reminders, updates, localization, feed, timer, fileOpener }
}
