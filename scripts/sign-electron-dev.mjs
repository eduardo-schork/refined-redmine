// The Electron binary downloaded by npm is unsigned on macOS, and macOS drops
// notifications from unsigned apps. Applies an ad-hoc signature to the dev binary.
// Runs on postinstall; also available as `npm run sign:dev`.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const electronApp = join('node_modules', 'electron', 'dist', 'Electron.app')

function isSigned(appPath) {
    try {
        execFileSync('codesign', ['-v', appPath], { stdio: 'ignore' })
        return true
    } catch {
        return false
    }
}

function signAdHoc(appPath) {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}

if (process.platform !== 'darwin' || !existsSync(electronApp)) process.exit(0)

if (isSigned(electronApp)) {
    console.log('[sign:dev] Electron.app is already signed.')
} else {
    signAdHoc(electronApp)
    console.log('[sign:dev] Electron.app signed (ad-hoc) — macOS notifications enabled in dev mode.')
}
