import { safeStorage } from 'electron'
import type { SecretStore } from '@application/ports/repositories'
import type { ConfigFile } from '../persistence/files'
import type { JsonFile } from '../persistence/json-file'

/** API key encrypted by the OS (Keychain on macOS, DPAPI on Windows). */
export class SafeStorageSecretStore implements SecretStore {
    /** Decrypting goes through the Keychain/DPAPI on every call, so the result is kept for the same stored value. */
    private decrypted?: { encrypted: string; apiKey: string }

    constructor(private readonly file: JsonFile<ConfigFile>) {}

    getApiKey(): string | null {
        const config = this.file.read()
        if (!config.apiKeyEnc) return config.apiKeyPlain ?? null
        if (this.decrypted?.encrypted === config.apiKeyEnc) return this.decrypted.apiKey
        try {
            const apiKey = safeStorage.decryptString(Buffer.from(config.apiKeyEnc, 'base64'))
            this.decrypted = { encrypted: config.apiKeyEnc, apiKey }
            return apiKey
        } catch {
            return null
        }
    }

    saveApiKey(apiKey: string): void {
        const secure = safeStorage.isEncryptionAvailable()
        const apiKeyEnc = secure ? safeStorage.encryptString(apiKey).toString('base64') : undefined
        const apiKeyPlain = secure ? undefined : apiKey
        this.file.update((config) => ({ ...config, apiKeyEnc, apiKeyPlain }))
    }

    clear(): void {
        this.decrypted = undefined
        this.file.update((config) => ({ ...config, apiKeyEnc: undefined, apiKeyPlain: undefined }))
    }

    /**
     * A key that cannot be decrypted (another computer, another app signature, Keychain reset) counts as missing,
     * so the app goes back to the connection screen instead of failing every request.
     */
    hasApiKey(): boolean {
        return this.getApiKey() !== null
    }
}
