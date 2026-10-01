import { app, powerMonitor } from 'electron'
import type { AppNotification } from '@domain/notification/notification'
import { createContainer, type Presentation } from './container'
import { registerApi } from './ipc-router'
import { TrayController } from './tray'
import { MainWindow } from './window'

const APP_ID = 'com.eduardoschork.refinedredmine'

const window = new MainWindow()
let tray: TrayController

function countUnread(items: AppNotification[]): number {
    return items.filter((notification) => !notification.read).length
}

const presentation: Presentation = {
    showWindow: (route) => window.show(route),
    publisher: {
        notificationsChanged: (items) => {
            window.send('notifications.changed', items)
            tray?.setUnread(countUnread(items))
        },
        monitorStatusChanged: (status) => window.send('monitor.status', status),
        permissionChanged: (info) => window.send('permission.changed', info),
        updateStatusChanged: (status) => window.send('update.status', status),
        timerChanged: (timer) => {
            window.send('timer.status', timer)
            tray?.setTimer(timer)
        }
    },
    quitApp: () => {
        window.markQuitting()
        app.quit()
    }
}

function startApp(): void {
    // Required for notifications on Windows (must match the electron-builder appId).
    app.setAppUserModelId(APP_ID)
    const container = createContainer(() => presentation)
    registerApi(container.api)

    tray = new TrayController(container.localization, {
        open: (route) => window.show(route),
        checkNow: () => void container.monitor.runNow(),
        pauseTimer: () => container.timer.pause(),
        resumeTimer: () => container.timer.resume(),
        quit: () => {
            window.markQuitting()
            app.quit()
        }
    })
    container.localization.onChange(() => tray.render())

    window.create()
    tray.create()
    tray.setUnread(countUnread(container.feed.list()))
    container.monitor.start()
    container.reminders.start()
    container.updates.start()
    container.timer.start()
    tray.setTimer(container.timer.status())
    // The stopwatch does not count while the computer sleeps or the screen is locked.
    powerMonitor.on('suspend', () => container.timer.onSleep())
    powerMonitor.on('lock-screen', () => container.timer.onSleep())
    powerMonitor.on('resume', () => {
        container.monitor.checkAfterWake()
        container.reminders.tick()
    })

    app.on('activate', () => window.show())
}

function registerLifecycle(): void {
    app.on('second-instance', () => window.show())
    void app.whenReady().then(startApp)
    app.on('before-quit', () => window.markQuitting())
    // Does not quit when the window is closed: keeps running in the tray.
    app.on('window-all-closed', () => {})
}

// Isolated profile (e.g. the demo data used for the manual screenshots): must be set before the app is ready.
const customUserData = process.env.REFINED_REDMINE_USER_DATA
if (customUserData) app.setPath('userData', customUserData)

// Fuses do not cover Chromium's remote debugging: it would let any local program drive the installed app
// (and its Redmine session) through the DevTools protocol. Development builds keep it for testing.
const DEBUG_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk']

function debuggingRequested(): boolean {
    return DEBUG_SWITCHES.some((name) => app.commandLine.hasSwitch(name))
}

function launch(): void {
    if (app.isPackaged && debuggingRequested()) {
        app.exit(1)
        return
    }
    const isFirstInstance = app.requestSingleInstanceLock()
    if (isFirstInstance) registerLifecycle()
    else app.quit()
}

launch()
