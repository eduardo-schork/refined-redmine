import type { i18n } from 'i18next'
import type { Localization } from '@application/ports/system'
import type { Language } from '@domain/settings/settings'
import { createI18n, resolveLocale, type Locale } from '@shared/i18n/index'
import { DateFormatter } from '@shared/i18n/format/dates'

/** Main process i18n (tray and system notification texts). */
export class MainLocalization implements Localization {
    private readonly instance: i18n
    private current: Locale
    private listeners: (() => void)[] = []

    constructor(
        preference: Language,
        private readonly systemLocale: () => string
    ) {
        this.current = resolveLocale(preference, systemLocale())
        this.instance = createI18n(this.current)
    }

    get locale(): Locale {
        return this.current
    }

    get t() {
        return this.instance.t
    }

    get dates(): DateFormatter {
        return new DateFormatter(this.current, this.instance.t)
    }

    setLanguage(language: Language): void {
        this.current = resolveLocale(language, this.systemLocale())
        void this.instance.changeLanguage(this.current)
        for (const listener of this.listeners) listener()
    }

    onChange(listener: () => void): void {
        this.listeners.push(listener)
    }
}
