/** A published version of the app (a GitHub Release). */
export interface Release {
    version: string
    name: string
    /** Release notes in Markdown. */
    notes: string
    publishedAt: string
    pageUrl: string
    assets: ReleaseAsset[]
}

export interface ReleaseAsset {
    id: number
    name: string
    size: number
    /** API address used to download it (a token is only needed while the repository is private). */
    downloadUrl: string
    /** SHA-256 GitHub computed for the file (hex), checked after downloading; absent on old releases. */
    sha256?: string
}

export type UpdatePhase = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'ready' | 'error'

/** What the Settings screen and the sidebar show about updates. */
export interface UpdateStatus {
    phase: UpdatePhase
    currentVersion: string
    /** A personal token is optional: it raises GitHub's limit of 60 checks per hour per network address. */
    hasToken: boolean
    latest?: Release
    checkedAt?: string
    /** 0..1 while downloading. */
    progress?: number
    /** Downloaded installer, ready to open. */
    installerPath?: string
    error?: { code: string; params: Record<string, string | number> }
}

// electron-builder artifact names (see electron-builder.yml): the platform and architecture are in the file name.
const INSTALLER_SUFFIXES: Record<string, string> = {
    'darwin-arm64': '-mac-arm64.dmg',
    'darwin-x64': '-mac-x64.dmg',
    'win32-x64': '-windows-setup.exe'
}

function versionParts(version: string): number[] {
    const withoutPrefix = version.trim().replace(/^v/i, '')
    const withoutPrerelease = withoutPrefix.split('-')[0]
    return withoutPrerelease.split('.').map((part) => Number(part) || 0)
}

/** Semantic version order: 0.9.0 < 0.10.0 < 1.0.0. Pre-release suffixes are ignored. */
export function compareVersions(first: string, second: string): number {
    const firstParts = versionParts(first)
    const secondParts = versionParts(second)
    const length = Math.max(firstParts.length, secondParts.length, 3)
    for (let index = 0; index < length; index++) {
        const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0)
        if (difference) return difference
    }
    return 0
}

export const isNewerVersion = (candidate: string, current: string) => compareVersions(candidate, current) > 0

/** The installer for this computer, or undefined when the release has none for it. */
export function installerFor(release: Release, platform: string, arch: string): ReleaseAsset | undefined {
    const suffix = INSTALLER_SUFFIXES[`${platform}-${arch}`]
    if (!suffix) return undefined
    return release.assets.find((asset) => asset.name.toLowerCase().endsWith(suffix))
}

/** Notes of one version inside the CHANGELOG ("## 0.2.0 — …" up to the next "## "). */
export function changelogSection(changelog: string, version: string): string | undefined {
    const lines = changelog.split('\n')
    const start = lines.findIndex((line) => line.startsWith('## ') && versionOfHeading(line) === version)
    if (start === -1) return undefined
    const nextHeading = lines.findIndex((line, index) => index > start && line.startsWith('## '))
    const end = nextHeading === -1 ? lines.length : nextHeading
    return lines
        .slice(start + 1, end)
        .join('\n')
        .trim()
}

function versionOfHeading(heading: string): string | undefined {
    const match = heading.match(/^##\s+v?(\d+\.\d+\.\d+)/)
    return match?.[1]
}
