import { shell } from 'electron'
import { spawn } from 'node:child_process'
import type { Installer } from '@application/ports/updates'
import { AppError } from '@domain/shared/errors'

const QUIT_DELAY_MS = 1_500

/**
 * macOS: opens the .dmg (the user drags the app to Applications) and quits, so the old copy is not in use.
 * Windows: runs the NSIS installer silently over the current installation, relaunching the app when done.
 */
export class DesktopInstaller implements Installer {
    constructor(private readonly quitApp: () => void) {}

    async open(installerPath: string): Promise<void> {
        if (process.platform === 'win32') {
            this.runWindowsInstaller(installerPath)
            return
        }
        const failure = await shell.openPath(installerPath)
        if (failure) throw new AppError('unexpected', { detail: failure })
        setTimeout(this.quitApp, QUIT_DELAY_MS)
    }

    private runWindowsInstaller(installerPath: string): void {
        const installer = spawn(installerPath, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore' })
        installer.unref()
        this.quitApp()
    }
}
