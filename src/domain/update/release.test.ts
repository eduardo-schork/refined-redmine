import { describe, expect, it } from 'vitest'
import { changelogSection, compareVersions, installerFor, isNewerVersion, type Release } from './release'

const release: Release = {
    version: '0.2.0',
    name: 'Refined Redmine 0.2.0',
    notes: '',
    publishedAt: '',
    pageUrl: '',
    assets: ['mac-arm64.dmg', 'mac-x64.dmg', 'windows-setup.exe'].map((suffix, index) => ({
        id: index,
        name: `refined-redmine-0.2.0-${suffix}`,
        size: 1,
        downloadUrl: `https://api.github.com/assets/${index}`
    }))
}

describe('versions', () => {
    it('compares numerically and ignores the v prefix', () => {
        expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
        expect(compareVersions('v1.0', '1.0.0')).toBe(0)
        expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true)
        expect(isNewerVersion('0.2.0', '0.2.0')).toBe(false)
    })
})

describe('installerFor', () => {
    it('picks the installer of this computer', () => {
        expect(installerFor(release, 'darwin', 'arm64')?.name).toBe('refined-redmine-0.2.0-mac-arm64.dmg')
        expect(installerFor(release, 'darwin', 'x64')?.name).toBe('refined-redmine-0.2.0-mac-x64.dmg')
        expect(installerFor(release, 'win32', 'x64')?.name).toBe('refined-redmine-0.2.0-windows-setup.exe')
        expect(installerFor(release, 'linux', 'x64')).toBeUndefined()
    })
})

describe('changelogSection', () => {
    const changelog = '# Novidades\n\n## 0.2.0 — atualizações\n\n- Uma\n- Duas\n\n## 0.1.0 — primeira\n\n- Velha\n'
    it('returns the notes of one version', () => expect(changelogSection(changelog, '0.2.0')).toBe('- Uma\n- Duas'))
    it('unknown version: undefined', () => expect(changelogSection(changelog, '9.9.9')).toBeUndefined())
})
