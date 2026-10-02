import { app, shell } from 'electron'
import { rmSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileOpener } from '@application/ports/system'
import { AppError } from '@domain/shared/errors'

/**
 * Writes the attachment to a folder of its own inside the profile (readable only by the user) and opens it with
 * the system's default app. The files are removed when the app starts and when it quits.
 */
export class TempFileOpener implements FileOpener {
    private readonly root = join(app.getPath('userData'), 'opened-attachments')

    async open(fileName: string, bytes: Uint8Array): Promise<void> {
        await mkdir(this.root, { recursive: true, mode: 0o700 })
        const folder = await mkdtemp(join(this.root, 'file-'))
        const path = join(folder, fileName)
        await writeFile(path, bytes, { mode: 0o600 })
        const failure = await shell.openPath(path)
        if (failure) throw new AppError('attachment.openFailed', { detail: failure })
    }

    /** Synchronous so it finishes before the process exits. A file still open elsewhere (Windows) stays. */
    clear(): void {
        try {
            rmSync(this.root, { recursive: true, force: true })
        } catch {
            // Left for the next start.
        }
    }
}
