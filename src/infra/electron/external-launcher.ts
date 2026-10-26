import { clipboard, shell } from 'electron'
import type { ExternalLauncher } from '@application/ports/system'

export const electronLauncher: ExternalLauncher = {
    openUrl: (url) => shell.openExternal(url),
    copyText: (text) => clipboard.writeText(text)
}
