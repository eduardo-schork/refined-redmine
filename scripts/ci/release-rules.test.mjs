import { describe, expect, it } from 'vitest'
import { changelogWithVersion, nextVersion, nextVersionItems, packageFilesWithVersion } from './release-rules.mjs'

describe('nextVersion', () => {
    it('raises the minor for a feature and the patch for a fix', () => {
        expect(nextVersion('0.5.0', ['fix: typo', 'feat: quick actions', 'docs: manual'])).toBe('0.6.0')
        expect(nextVersion('0.5.0', ['fix(board): counters', 'chore: deps'])).toBe('0.5.1')
    })

    it('does not release for docs, chores or its own release commit', () => {
        expect(nextVersion('0.5.0', ['docs: manual', 'chore: lint', 'refactor: names'])).toBeNull()
        expect(nextVersion('0.6.0', ['chore: release 0.6.0 — summary'])).toBeNull()
        expect(nextVersion('0.5.0', [])).toBeNull()
    })

    it('treats a breaking change as minor while the app is 0.x, major afterwards', () => {
        expect(nextVersion('0.5.0', ['feat!: new settings format'])).toBe('0.6.0')
        expect(nextVersion('1.2.3', ['fix!: drop old files'])).toBe('2.0.0')
    })

    it('ignores words that only look like a type', () => {
        expect(nextVersion('0.5.0', ['featured list tweak', 'fixup wording'])).toBeNull()
    })
})

describe('changelogWithVersion', () => {
    const changelog = [
        '# Novidades',
        '',
        '## Próxima versão — ações rápidas',
        '',
        '<!-- Ao publicar, troque o título -->',
        '',
        '- Item',
        '',
        '## 0.5.0 — antes',
        ''
    ].join('\n')

    it('turns the next version heading into the version and drops the reminder', () => {
        const result = changelogWithVersion(changelog, '0.6.0')
        expect(result).toContain('## 0.6.0 — ações rápidas\n\n- Item')
        expect(result).not.toContain('Próxima versão')
        expect(result).not.toContain('<!--')
        expect(result).toContain('## 0.5.0 — antes')
    })

    it('refuses to release without notes', () => {
        expect(() => changelogWithVersion('# Novidades\n\n## 0.5.0\n', '0.6.0')).toThrow(/Próxima versão/)
    })
})

describe('nextVersionItems', () => {
    it('lists the items of the next version only', () => {
        const changelog = '# Novidades\n\n## Próxima versão\n\n- Um\n- Dois\n\n## 0.5.0\n\n- Velho\n'
        expect(nextVersionItems(changelog)).toEqual(['- Um', '- Dois'])
    })

    it('is empty without the section or without items', () => {
        expect(nextVersionItems('# Novidades\n\n## 0.5.0\n\n- Velho\n')).toEqual([])
        expect(nextVersionItems('# Novidades\n\n## Próxima versão\n\n## 0.5.0\n\n- Velho\n')).toEqual([])
    })
})

describe('packageFilesWithVersion', () => {
    it('updates package.json and both version fields of the lock', () => {
        const manifest = JSON.stringify({ name: 'refined-redmine', version: '0.5.0' }, null, 2)
        const lock = JSON.stringify(
            {
                name: 'refined-redmine',
                version: '0.5.0',
                packages: { '': { version: '0.5.0' }, 'node_modules/a': { version: '1.0.0' } }
            },
            null,
            2
        )
        const result = packageFilesWithVersion(manifest, lock, '0.6.0')
        expect(JSON.parse(result.packageJson).version).toBe('0.6.0')
        const updatedLock = JSON.parse(result.packageLock)
        expect(updatedLock.version).toBe('0.6.0')
        expect(updatedLock.packages[''].version).toBe('0.6.0')
        expect(updatedLock.packages['node_modules/a'].version).toBe('1.0.0')
    })
})
