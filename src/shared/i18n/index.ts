import i18next, { type i18n, type TFunction } from 'i18next'
import { type SUPPORTED_LANGUAGES, type Language } from '@domain/settings/settings'
import { ptBR } from './locales/pt-BR'
import { enUS } from './locales/en-US'

export type Locale = (typeof SUPPORTED_LANGUAGES)[number]
export type { TFunction }

export const DEFAULT_LOCALE: Locale = 'pt-BR'

export const resources = {
    'pt-BR': { translation: ptBR },
    'en-US': { translation: enUS }
} as const

/** 'system' follows the operating system language; unsupported languages fall back to the default. */
export function resolveLocale(preference: Language, systemLocale: string): Locale {
    if (preference !== 'system') return preference

    const systemLanguage = systemLocale.toLowerCase()
    if (systemLanguage.startsWith('pt')) return 'pt-BR'
    if (systemLanguage.startsWith('en')) return 'en-US'
    return DEFAULT_LOCALE
}

/** Initialization is synchronous because the resources are bundled, so the instance is ready on return. */
export function createI18n(locale: Locale): i18n {
    const instance = i18next.createInstance()
    void instance.init({
        resources,
        lng: locale,
        fallbackLng: DEFAULT_LOCALE,
        initAsync: false,
        interpolation: { escapeValue: false },
        returnNull: false
    })
    return instance
}
