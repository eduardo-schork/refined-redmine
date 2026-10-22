import type { Release, ReleaseAsset } from '@domain/update/release'

/** Where versions are published (GitHub Releases of the app's public repository). A token is optional. */
export interface ReleaseSource {
    /** Latest published release, or null when there is none yet. Errors surface as AppError (`update.*`). */
    latest(token: string | null): Promise<Release | null>
    /** Downloads the installer, checks its SHA-256 when GitHub gave one, and returns the file path. */
    download(asset: ReleaseAsset, token: string | null, onProgress: (fraction: number) => void): Promise<string>
}

/** Opens a downloaded installer (macOS: the .dmg window; Windows: runs the installer and quits the app). */
export interface Installer {
    open(installerPath: string): Promise<void>
}

/** An optional GitHub token of the user, encrypted by the operating system like the Redmine key. */
export interface UpdateTokenStore {
    get(): string | null
    save(token: string): void
    clear(): void
}
