// Publishes a version as a GitHub Release of the private repository.
// Usage:  GITHUB_TOKEN=<your token> npm run release -- [--skip-build] [--draft] [--allow-dirty]
//   --skip-build   reuse the installers already in dist/
//   --draft        leave the release as a draft (not visible to the apps until published on GitHub)
//   --allow-dirty  skip the "everything committed and pushed" check
// Step by step: docs/RELEASE.md
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPOSITORY = 'eduardo-schork/refined-redmine'
const API = 'https://api.github.com'
const UPLOADS = 'https://uploads.github.com'

const flags = new Set(process.argv.slice(2))
const skipBuild = flags.has('--skip-build')
const asDraft = flags.has('--draft')
const allowDirty = flags.has('--allow-dirty')

function fail(message) {
    console.error(`\n✖ ${message}\n`)
    process.exit(1)
}

function step(message) {
    console.log(`\n→ ${message}`)
}

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

/** The token is only for the GitHub API calls below; builds never see it, so they cannot publish on their own. */
function environmentWithoutTokens() {
    const { GITHUB_TOKEN: _github, GH_TOKEN: _gh, ...environment } = process.env
    return environment
}

function run(command, args) {
    const options = { stdio: 'inherit', shell: process.platform === 'win32', env: environmentWithoutTokens() }
    const result = spawnSync(command, args, options)
    if (result.status !== 0) fail(`"${command} ${args.join(' ')}" failed.`)
}

function readVersion() {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    return packageJson.version
}

/** Notes of the version in CHANGELOG.md: from "## <version>" up to the next "## ". */
function releaseNotes(version) {
    const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n')
    const start = lines.findIndex((line) => new RegExp(`^##\\s+v?${version.replaceAll('.', '\\.')}\\b`).test(line))
    if (start === -1) fail(`CHANGELOG.md has no "## ${version}" section. Write the notes of this version first.`)
    const next = lines.findIndex((line, index) => index > start && line.startsWith('## '))
    const end = next === -1 ? lines.length : next
    return {
        title: lines[start].replace(/^##\s+/, ''),
        body: lines
            .slice(start + 1, end)
            .join('\n')
            .trim()
    }
}

function checkGit() {
    if (allowDirty) return
    if (git('status', '--porcelain')) fail('There are uncommitted changes. Commit them (or use --allow-dirty).')
    const unpushed = git('rev-list', '--count', '@{u}..HEAD')
    if (unpushed !== '0') fail(`${unpushed} commit(s) not pushed. Run git push first (the release points to HEAD).`)
}

function installers(version) {
    const names = [
        `refined-redmine-${version}-mac-arm64.dmg`,
        `refined-redmine-${version}-mac-x64.dmg`,
        `refined-redmine-${version}-windows-setup.exe`
    ]
    const paths = names.map((name) => join('dist', name))
    const missing = paths.filter((path) => !existsSync(path))
    if (missing.length) fail(`Installers not found:\n  ${missing.join('\n  ')}`)
    return paths
}

async function github(token, method, url, body, contentType = 'application/json') {
    const response = await fetch(url, {
        method,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': contentType
        },
        body: contentType === 'application/json' && body ? JSON.stringify(body) : body
    })
    if (response.status === 404 && method === 'GET') return null
    if (!response.ok) fail(`GitHub answered ${response.status} to ${method} ${url}:\n${await response.text()}`)
    return response.status === 204 ? null : response.json()
}

async function main() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (!token) fail('Set GITHUB_TOKEN with your token (classic, repo scope). It is only used for this run.')

    const version = readVersion()
    const tag = `v${version}`
    step(`Version ${version} (tag ${tag})`)
    const notes = releaseNotes(version)
    checkGit()

    const existing = await github(token, 'GET', `${API}/repos/${REPOSITORY}/releases/tags/${tag}`)
    if (existing) fail(`Release ${tag} already exists: ${existing.html_url}. Bump the version in package.json.`)

    if (!skipBuild) {
        step('Checks (types, lint, tests)')
        run('npm', ['run', 'check'])
        step('macOS installers')
        run('npm', ['run', 'dist:mac'])
        step('Windows installer')
        run('npm', ['run', 'dist:win'])
    }
    const files = installers(version)

    step('Creating the release (draft)')
    const release = await github(token, 'POST', `${API}/repos/${REPOSITORY}/releases`, {
        tag_name: tag,
        target_commitish: git('rev-parse', 'HEAD'),
        name: `Refined Redmine ${notes.title}`,
        body: notes.body,
        draft: true
    })

    for (const path of files) {
        const name = path.split(/[\\/]/).pop()
        const megabytes = (statSync(path).size / 1024 / 1024).toFixed(0)
        step(`Uploading ${name} (${megabytes} MB)`)
        const uploadUrl = `${UPLOADS}/repos/${REPOSITORY}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`
        await github(token, 'POST', uploadUrl, readFileSync(path), 'application/octet-stream')
    }

    if (asDraft) {
        console.log(`\n✔ Draft ready (not visible to the apps yet): ${release.html_url}\n`)
        return
    }
    step('Publishing')
    const published = await github(token, 'PATCH', `${API}/repos/${REPOSITORY}/releases/${release.id}`, {
        draft: false
    })
    console.log(`\n✔ Published: ${published.html_url}\n  Apps with a token will see it on the next check.\n`)
}

main().catch((error) => fail(error.message))
