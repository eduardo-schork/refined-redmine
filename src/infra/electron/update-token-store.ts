import { safeStorage } from 'electron'
import type { UpdateTokenStore } from '@application/ports/updates'
import type { ConfigFile } from '../persistence/files'
import type { JsonFile } from '../persistence/json-file'

/**
 * GitHub token encrypted by the OS (Keychain/DPAPI). Without encryption available it is not stored at all:
 * a token with access to the repository is not kept in plain text.
 */
export class SafeStorageUpdateTokenStore implements UpdateTokenStore {
    constructor(private readonly file: JsonFile<ConfigFile>) {}

    get(): string | null {
        const encrypted = this.file.read().githubTokenEnc
        if (!encrypted) return null
        try {
            return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
        } catch {
            return null
        }
    }

    save(token: string): void {
        if (!safeStorage.isEncryptionAvailable()) return
        const githubTokenEnc = safeStorage.encryptString(token).toString('base64')
        this.file.update((config) => ({ ...config, githubTokenEnc }))
    }

    clear(): void {
        this.file.update((config) => ({ ...config, githubTokenEnc: undefined }))
    }
}
