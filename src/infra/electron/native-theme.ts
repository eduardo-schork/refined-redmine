import { nativeTheme } from 'electron'
import type { ThemeController } from '@application/ports/system'
import type { ThemeMode } from '@domain/settings/appearance'

const WINDOW_BACKGROUND = { light: '#f6f7f9', dark: '#0b0d12' }

export class ElectronNativeTheme implements ThemeController {
    setThemeMode(mode: ThemeMode): void {
        nativeTheme.themeSource = mode
    }
}

/** Background painted before the page loads, so the window does not flash in the wrong theme. */
export function windowBackground(): string {
    return nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light
}
