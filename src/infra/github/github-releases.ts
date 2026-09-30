import { net } from 'electron'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { ReleaseSource } from '@application/ports/updates'
import type { HttpLogEntry } from '@domain/log/log-entry'
import { AppError } from '@domain/shared/errors'
import { redactSecret } from '@domain/shared/secrets'
import type { Release, ReleaseAsset } from '@domain/update/release'

export const RELEASES_REPOSITORY = 'eduardo-schork/refined-redmine'
/**
 * Collaborators of a personal repository have write access and could publish a release; installers are only
 * accepted from the repository owner, since the app runs them (silently on Windows).
 */
export const TRUSTED_PUBLISHER = 'eduardo-schork'

const API = 'https://api.github.com'
const API_VERSION = '2022-11-28'

type RequestRecord = Omit<HttpLogEntry, 'type'>

interface GithubRelease {
    tag_name: string
    name: string | null
    body: string | null
    published_at: string
    html_url: string
    author: { login: string } | null
    assets: { id: number; name: string; size: number; url: string; uploader: { login: string } | null }[]
}

function headers(token: string, accept = 'application/vnd.github+json'): Record<string, string> {
    return { Accept: accept, Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': API_VERSION }
}

function toRelease(release: GithubRelease): Release {
    const publisher = release.author?.login
    if (publisher !== TRUSTED_PUBLISHER) throw new AppError('update.untrusted', { publisher: publisher ?? '?' })
    const trustedAssets = release.assets.filter((asset) => asset.uploader?.login === TRUSTED_PUBLISHER)
    return {
        version: release.tag_name.replace(/^v/i, ''),
        name: release.name || release.tag_name,
        notes: release.body ?? '',
        publishedAt: release.published_at,
        pageUrl: release.html_url,
        assets: trustedAssets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            size: asset.size,
            downloadUrl: asset.url
        }))
    }
}

function httpError(status: number): AppError {
    if (status === 401) return new AppError('update.unauthorized', {}, status)
    if (status === 403 || status === 404) return new AppError('update.notFound', {}, status)
    return new AppError('update.http', { status }, status)
}

/**
 * GitHub Releases of the private repository, read with each user's own token.
 * GitHub answers 404 both for "no release yet" and "no access", so a 404 is double-checked on the repository itself.
 */
export class GithubReleaseSource implements ReleaseSource {
    constructor(
        private readonly downloadsDir: () => string,
        private readonly observe: (record: RequestRecord) => void = () => {}
    ) {}

    async latest(token: string): Promise<Release | null> {
        const response = await this.get(`${API}/repos/${RELEASES_REPOSITORY}/releases/latest`, headers(token), token)
        if (response.ok) return toRelease((await response.json()) as GithubRelease)
        if (response.status !== 404) throw httpError(response.status)

        const repository = await this.get(`${API}/repos/${RELEASES_REPOSITORY}`, headers(token), token)
        if (!repository.ok) throw httpError(repository.status)
        return null
    }

    async download(asset: ReleaseAsset, token: string, onProgress: (fraction: number) => void): Promise<string> {
        const fileUrl = await this.storageUrl(asset, token)
        const response = await this.get(fileUrl, {})
        if (!response.ok || !response.body) throw httpError(response.status)

        const target = join(this.downloadsDir(), basename(asset.name))
        const partial = `${target}.part`
        try {
            const received = await this.save(response.body, partial, asset.size, onProgress)
            // An interrupted download must not become an installer.
            const incomplete = asset.size > 0 && received !== asset.size
            if (incomplete) throw new AppError('update.http', { status: 'incomplete' })
            await rename(partial, target)
            return target
        } catch (error) {
            await rm(partial, { force: true })
            throw error
        }
    }

    /**
     * The asset API answers with a redirect to a signed storage address. The redirect is followed by hand so the
     * token is not sent to the storage server (it refuses requests carrying two credentials).
     */
    private storageUrl(asset: ReleaseAsset, token: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now()
            const request = net.request({ url: asset.downloadUrl, redirect: 'manual' })
            for (const [name, value] of Object.entries(headers(token, 'application/octet-stream'))) {
                request.setHeader(name, value)
            }
            request.on('redirect', (status, _method, redirectUrl) => {
                this.record('GET', asset.downloadUrl, status, startedAt, 0)
                request.abort()
                resolve(redirectUrl)
            })
            request.on('response', (response) => {
                this.record('GET', asset.downloadUrl, response.statusCode, startedAt, 0)
                reject(httpError(response.statusCode))
            })
            request.on('error', (error) =>
                reject(
                    new AppError('network.unknown', { host: 'github.com', detail: redactSecret(error.message, token) })
                )
            )
            request.end()
        })
    }

    private async save(
        body: ReadableStream<Uint8Array>,
        path: string,
        expectedBytes: number,
        onProgress: (fraction: number) => void
    ): Promise<number> {
        const file = createWriteStream(path)
        const reader = body.getReader()
        let received = 0
        try {
            for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
                const accepted = file.write(chunk.value)
                if (!accepted) await once(file, 'drain')
                received += chunk.value.length
                if (expectedBytes > 0) onProgress(Math.min(1, received / expectedBytes))
            }
        } finally {
            await new Promise<void>((resolve) => file.end(resolve))
        }
        return received
    }

    private async get(url: string, requestHeaders: Record<string, string>, token?: string): Promise<Response> {
        const startedAt = Date.now()
        try {
            const response = await net.fetch(url, { headers: requestHeaders })
            const bytes = Number(response.headers.get('content-length') ?? 0)
            this.record('GET', url, response.status, startedAt, bytes)
            return response
        } catch (error) {
            this.record('GET', url, undefined, startedAt, 0, 'network.unknown')
            const detail = redactSecret(String(error), token)
            throw new AppError('network.unknown', { host: new URL(url).host, detail })
        }
    }

    /** Signed storage addresses carry temporary credentials in the query string, so only the path is logged. */
    private record(
        method: string,
        url: string,
        status: number | undefined,
        startedAt: number,
        bytes: number,
        errorCode?: string
    ): void {
        const parsed = new URL(url)
        const isApi = parsed.host === 'api.github.com'
        const loggedUrl = `${parsed.host}${parsed.pathname}${isApi ? parsed.search : ''}`
        const failed = status !== undefined && status >= 400
        const code = errorCode ?? (failed ? `http.${status}` : undefined)
        this.observe({
            method,
            url: loggedUrl,
            status,
            durationMs: Date.now() - startedAt,
            bytes,
            attempt: 1,
            errorCode: code
        })
    }
}
