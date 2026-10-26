import { dialog } from 'electron'
import { readFile, stat, writeFile } from 'node:fs/promises'
import type { FileDialogs } from '@application/ports/system'
import { AppError } from '@domain/shared/errors'

const JSON_FILES = [{ name: 'JSON', extensions: ['json'] }]

export const electronFileDialogs: FileDialogs = {
    async saveText(suggestedName, text) {
        const picked = await dialog.showSaveDialog({ defaultPath: suggestedName, filters: JSON_FILES })
        if (picked.canceled || !picked.filePath) return false
        await writeFile(picked.filePath, text, 'utf8')
        return true
    },
    async openText(maxBytes) {
        const picked = await dialog.showOpenDialog({ properties: ['openFile'], filters: JSON_FILES })
        const path = picked.filePaths[0]
        if (picked.canceled || !path) return null
        if ((await stat(path)).size > maxBytes) throw new AppError('backup.invalid')
        return readFile(path, 'utf8')
    }
}
