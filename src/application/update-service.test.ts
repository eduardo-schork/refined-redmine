import { describe, expect, it } from 'vitest'
import { AppError } from '@domain/shared/errors'
import type { Release, ReleaseAsset } from '@domain/update/release'
import type { ReleaseSource } from './ports/updates'
import { UpdateService } from './services/update-service'
import { FakeEvents, FixedClock, MemorySettings, noScheduler } from './testing/fakes'

const release = (version: string): Release => ({
    version,
    name: version,
    notes: '- novidade',
    publishedAt: '',
    pageUrl: 'https://github.com/x',
    assets: [{ id: 1, name: `refined-redmine-${version}-mac-arm64.dmg`, size: 10, downloadUrl: 'https://api/1' }]
})

class FakeSource implements ReleaseSource {
    published: Release | null = release('0.3.0')
    downloads: ReleaseAsset[] = []
    failWith?: AppError
    async latest() {
        if (this.failWith) throw this.failWith
        return this.published
    }
    async download(asset: ReleaseAsset, _token: string, onProgress: (fraction: number) => void) {
        this.downloads.push(asset)
        onProgress(0.5)
        onProgress(1)
        return `/downloads/${asset.name}`
    }
}

function setup(token: string | null = 'ghp_token') {
    const source = new FakeSource()
    const tokens = {
        value: token,
        get() {
            return this.value
        },
        save(next: string) {
            this.value = next
        },
        clear() {
            this.value = null
        }
    }
    const opened: string[] = []
    const events = new FakeEvents()
    const service = new UpdateService({
        source,
        tokens,
        installer: { open: async (path) => void opened.push(path) },
        settings: new MemorySettings(),
        events,
        clock: new FixedClock(new Date('2026-09-29T12:00:00Z')),
        scheduler: noScheduler,
        currentVersion: '0.2.0',
        platform: 'darwin',
        arch: 'arm64'
    })
    return { service, source, tokens, opened, events }
}

describe('UpdateService', () => {
    it('without a token it stays disabled and never asks GitHub', async () => {
        const { service, source } = setup(null)
        source.failWith = new AppError('update.http', { status: 500 })
        expect((await service.check()).phase).toBe('disabled')
    })

    it('finds a newer version, downloads the installer of this computer and opens it', async () => {
        const { service, source, opened } = setup()
        expect((await service.check()).phase).toBe('available')
        const downloaded = await service.download()
        expect(downloaded).toMatchObject({
            phase: 'ready',
            installerPath: '/downloads/refined-redmine-0.3.0-mac-arm64.dmg'
        })
        expect(source.downloads).toHaveLength(1)
        await service.install()
        expect(opened).toEqual(['/downloads/refined-redmine-0.3.0-mac-arm64.dmg'])
    })

    it('the same or an older version is up to date', async () => {
        const { service, source } = setup()
        source.published = release('0.2.0')
        expect((await service.check()).phase).toBe('upToDate')
    })

    it('a daily check does not throw away an installer already downloaded', async () => {
        const { service } = setup()
        await service.check()
        await service.download()
        expect((await service.check()).phase).toBe('ready')
    })

    it('an invalid token becomes an error the screen can translate', async () => {
        const { service, source } = setup()
        source.failWith = new AppError('update.unauthorized', {}, 401)
        const status = await service.check()
        expect(status).toMatchObject({ phase: 'error', error: { code: 'update.unauthorized' } })
    })

    it('refuses a malformed token without saving it or calling GitHub', async () => {
        const { service, tokens } = setup(null)
        await expect(service.testToken('ghp_ok\nextra')).rejects.toMatchObject({ code: 'update.unauthorized' })
        await expect(service.setToken('ghp bad')).rejects.toMatchObject({ code: 'update.unauthorized' })
        expect(tokens.value).toBeNull()
    })

    it('saving a token checks right away; removing it disables updates', async () => {
        const { service, tokens } = setup(null)
        expect((await service.setToken('  ghp_new  ')).phase).toBe('available')
        expect(tokens.value).toBe('ghp_new')
        expect((await service.setToken(null)).phase).toBe('disabled')
    })
})
