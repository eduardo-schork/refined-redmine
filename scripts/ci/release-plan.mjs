// Automatic release helper for GitHub Actions (.github/workflows/release.yml).
//   node scripts/ci/release-plan.mjs plan           → decides whether this push releases, and the version
//   node scripts/ci/release-plan.mjs apply <version> → writes the version to package.json, the lock and CHANGELOG.md
// No token is used here: this script only reads git history and writes local files.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import {
    changelogWithVersion,
    isValidVersion,
    nextVersion,
    NEXT_VERSION_HEADING,
    nextVersionItems,
    packageFilesWithVersion
} from './release-rules.mjs'

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function lastTag() {
    try {
        return git('describe', '--tags', '--abbrev=0', '--match', 'v*')
    } catch {
        return null
    }
}

function subjectsSince(tag) {
    const range = tag ? `${tag}..HEAD` : 'HEAD'
    const output = git('log', '--format=%s', range)
    return output ? output.split('\n') : []
}

/** Outputs for the next jobs; printed too, so the run log shows the decision. */
function output(values) {
    for (const [key, value] of Object.entries(values)) {
        console.log(`${key}=${value}`)
        if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
    }
}

function plan() {
    const current = JSON.parse(readFileSync('package.json', 'utf8')).version
    const tag = lastTag()
    const subjects = subjectsSince(tag)
    const version = nextVersion(current, subjects)
    console.log(`Current version ${current}, last tag ${tag ?? '(none)'}, ${subjects.length} commit(s) since.`)
    if (!version) {
        console.log('No feat/fix commit since the last tag: nothing to release.')
        output({ release: 'false', version: '' })
        return
    }
    // Fail here, before any build, when the notes were not written.
    const items = nextVersionItems(readFileSync('CHANGELOG.md', 'utf8'))
    if (!items.length) {
        throw new Error(
            `Version ${version} is due, but CHANGELOG.md has no "${NEXT_VERSION_HEADING}" section with notes ("- …").`
        )
    }
    output({ release: 'true', version })
}

function apply(version) {
    if (!isValidVersion(version ?? '')) throw new Error(`Invalid version "${version}".`)
    writeFileSync('CHANGELOG.md', changelogWithVersion(readFileSync('CHANGELOG.md', 'utf8'), version))
    const { packageJson, packageLock } = packageFilesWithVersion(
        readFileSync('package.json', 'utf8'),
        readFileSync('package-lock.json', 'utf8'),
        version
    )
    writeFileSync('package.json', packageJson)
    writeFileSync('package-lock.json', packageLock)
    console.log(`Version ${version} written to package.json, package-lock.json and CHANGELOG.md.`)
}

const [command, argument] = process.argv.slice(2)
try {
    if (command === 'plan') plan()
    else if (command === 'apply') apply(argument)
    else throw new Error('Usage: release-plan.mjs plan | apply <version>')
} catch (error) {
    console.error(`✖ ${error.message}`)
    process.exit(1)
}
