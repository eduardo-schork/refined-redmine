import { app, BrowserWindow, shell } from 'electron'
import { windowBackground } from '@infra/electron/native-theme'
import { join } from 'node:path'
import { isHttpUrl } from '@domain/redmine/links'
import type { AppEvents } from '@contracts/api'

const isMac = process.platform === 'darwin'

export const resourcesPath = () => {
    if (app.isPackaged) return join(process.resourcesPath, 'app.asar.unpacked', 'resources')
    return join(__dirname, '../../resources')
}

/** Only opens http(s): never file:// or arbitrary schemes coming from remote data. */
export async function openExternal(url: string): Promise<void> {
    if (isHttpUrl(url)) await shell.openExternal(url)
}

function loadRenderer(browserWindow: BrowserWindow, devUrl: string | undefined): void {
    if (devUrl) {
        void browserWindow.loadURL(devUrl)
        return
    }
    void browserWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

/** Main window. Closing only hides it: the app keeps running in the tray. */
export class MainWindow {
    private browserWindow: BrowserWindow | null = null
    private quitting = false

    markQuitting(): void {
        this.quitting = true
    }

    create(): void {
        const browserWindow = new BrowserWindow({
            width: 1400,
            height: 880,
            minWidth: 900,
            minHeight: 600,
            show: false,
            title: 'Refined Redmine',
            icon: join(resourcesPath(), 'icon.png'),
            titleBarStyle: isMac ? 'hiddenInset' : 'default',
            trafficLightPosition: { x: 16, y: 18 },
            backgroundColor: windowBackground(),
            webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true }
        })
        this.browserWindow = browserWindow
        browserWindow.once('ready-to-show', () => browserWindow.show())
        browserWindow.on('close', (event) => {
            if (this.quitting) return
            event.preventDefault()
            browserWindow.hide()
        })
        browserWindow.webContents.setWindowOpenHandler(({ url }) => {
            void openExternal(url)
            return { action: 'deny' }
        })
        const devUrl = process.env['ELECTRON_RENDERER_URL']
        browserWindow.webContents.on('will-navigate', (event, url) => {
            if (devUrl && url.startsWith(devUrl)) return
            event.preventDefault()
            void openExternal(url)
        })
        loadRenderer(browserWindow, devUrl)
    }

    show(route?: string): void {
        if (!this.browserWindow) this.create()
        this.browserWindow!.show()
        this.browserWindow!.focus()
        if (route) this.send('navigate', route)
    }

    send<Event extends keyof AppEvents>(event: Event, payload: AppEvents[Event]): void {
        this.browserWindow?.webContents.send(event, payload)
    }
}
