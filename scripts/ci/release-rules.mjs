// Pure rules of the automatic release (no git, no files): which version comes next and how the version files change.
// Used by scripts/ci/release-plan.mjs; tested in release-rules.test.mjs.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const FEATURE = /^feat(\([^)]*\))?!?:/
const FIX = /^fix(\([^)]*\))?!?:/
const BREAKING = /^[a-z]+(\([^)]*\))?!:/
const RELEASE_COMMIT = /^chore: release /

export const NEXT_VERSION_HEADING = '## Próxima versão'

export function isValidVersion(version) {
    return SEMVER.test(version)
}

/**
 * Next version from the subjects of the commits since the last tag (Conventional Commits):
 * feat → minor, fix → patch, "!" → major (minor while the app is 0.x). Other types (docs, chore, refactor…)
 * do not release. Returns null when nothing releases.
 */
export function nextVersion(current, subjects) {
    const match = SEMVER.exec(current)
    if (!match) throw new Error(`Invalid current version "${current}".`)
    const [major, minor, patch] = match.slice(1).map(Number)
    const relevant = subjects.filter((subject) => !RELEASE_COMMIT.test(subject))
    const hasBreaking = relevant.some(
        (subject) => BREAKING.test(subject) && (FEATURE.test(subject) || FIX.test(subject))
    )
    const hasFeature = relevant.some((subject) => FEATURE.test(subject))
    const hasFix = relevant.some((subject) => FIX.test(subject))
    if (hasBreaking && major > 0) return `${major + 1}.0.0`
    if (hasBreaking || hasFeature) return `${major}.${minor + 1}.0`
    if (hasFix) return `${major}.${minor}.${patch + 1}`
    return null
}

/** Items ("- …") of the "Próxima versão" section; empty when the section is missing or has no items. */
export function nextVersionItems(changelog) {
    const lines = changelog.split('\n')
    const start = lines.findIndex((line) => line.startsWith(NEXT_VERSION_HEADING))
    if (start === -1) return []
    const next = lines.findIndex((line, index) => index > start && line.startsWith('## '))
    const section = lines.slice(start + 1, next === -1 ? lines.length : next)
    return section.filter((line) => line.startsWith('- '))
}

/** "## Próxima versão" or "## Próxima versão — summary" becomes "## 0.6.0" / "## 0.6.0 — summary". */
export function changelogWithVersion(changelog, version) {
    const lines = changelog.split('\n')
    const index = lines.findIndex((line) => line.startsWith(NEXT_VERSION_HEADING))
    if (index === -1) {
        throw new Error(
            `CHANGELOG.md has no "${NEXT_VERSION_HEADING}" section. Write the notes of the version before releasing.`
        )
    }
    const summary = lines[index].slice(NEXT_VERSION_HEADING.length)
    lines[index] = `## ${version}${summary}`
    // The reminder comment under the heading is for people editing by hand; the release no longer needs it.
    const withoutReminder = lines.filter(
        (line, lineIndex) => !(lineIndex > index && line.startsWith('<!-- Ao publicar'))
    )
    return withoutReminder.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** package.json and the two version fields of package-lock.json (root and packages[""]). */
export function packageFilesWithVersion(packageJson, packageLock, version) {
    const manifest = JSON.parse(packageJson)
    manifest.version = version
    const lock = JSON.parse(packageLock)
    lock.version = version
    if (lock.packages?.['']) lock.packages[''].version = version
    return {
        packageJson: `${JSON.stringify(manifest, null, 2)}\n`,
        packageLock: `${JSON.stringify(lock, null, 2)}\n`
    }
}
