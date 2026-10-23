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
    async latest(token: string | null) {
        this.tokensSeen.push(token)
        if (this.failWith) throw this.failWith
        return this.published
    }
    tokensSeen: (string | null)[] = []
    async download(asset: ReleaseAsset, _token: string | null, onProgress: (fraction: number) => void) {
        this.downloads.push(asset)
        onProgress(0.5)
        onProgress(1)
        return `/downloads/${asset.name}`
    }
}

function setup(token: string | null = 'ghp_token', scheduler = noScheduler, settings = new MemorySettings()) {
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
        settings,
        events,
        clock: new FixedClock(new Date('2026-09-29T12:00:00Z')),
        scheduler,
        currentVersion: '0.2.0',
        platform: 'darwin',
        arch: 'arm64'
    })
    return { service, source, tokens, opened, events }
}

describe('UpdateService', () => {
    it('checks at the interval chosen in the settings', () => {
        const intervals: number[] = []
        const scheduler = {
            after: () => () => {},
            every: (ms: number) => {
                intervals.push(ms)
                return () => {}
            }
        }
        const settings = new MemorySettings()
        settings.value = { ...settings.value, updates: { autoCheck: true, intervalHours: 4 } }
        setup('ghp_token', scheduler, settings).service.start()
        expect(intervals).toEqual([4 * 60 * 60 * 1000])
    })

    it('does not schedule anything with automatic checks off', () => {
        const calls: string[] = []
        const scheduler = {
            after: () => {
                calls.push('after')
                return () => {}
            },
            every: () => {
                calls.push('every')
                return () => {}
            }
        }
        const settings = new MemorySettings()
        settings.value = { ...settings.value, updates: { autoCheck: false, intervalHours: 24 } }
        setup('ghp_token', scheduler, settings).service.start()
        expect(calls).toEqual([])
    })

    it('without a token it still checks the public releases and downloads', async () => {
        const { service, source } = setup(null)
        expect((await service.check()).phase).toBe('available')
        expect(source.tokensSeen).toEqual([null])
        expect((await service.download()).phase).toBe('ready')
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

    it('saving a token checks right away with it; removing it goes back to checking without one', async () => {
        const { service, tokens, source } = setup(null)
        expect((await service.setToken('  ghp_new  ')).phase).toBe('available')
        expect(tokens.value).toBe('ghp_new')
        await service.setToken(null)
        expect(source.tokensSeen.at(-1)).toBeNull()
    })
})
