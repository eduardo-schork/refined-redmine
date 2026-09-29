import { useEffect, useMemo, type ReactNode } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import type { SerializedError } from '@domain/shared/errors'
import { createI18n, type Locale } from '@shared/i18n/index'
import { DateFormatter } from '@shared/i18n/format/dates'
import { errorMessage } from '@shared/i18n/format/errors'

// Single UI instance; switching the language only changes `lng`.
const instance = createI18n('pt-BR')

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
    if (instance.language !== locale) {
        void instance.changeLanguage(locale)
    }
    // Keep the document language in sync with the active locale (accessibility, spellcheck).
    useEffect(() => {
        document.documentElement.lang = locale
    }, [locale])
    return <I18nextProvider i18n={instance}>{children}</I18nextProvider>
}

export function useI18n() {
    const { t, i18n } = useTranslation()
    const locale = i18n.language as Locale
    const dates = useMemo(() => new DateFormatter(locale, t), [locale, t])
    const error = (err: unknown) => errorMessage(toSerialized(err), t)
    return { t, locale, dates, error }
}

function isSerializedError(err: unknown): err is SerializedError {
    return Boolean(err) && typeof err === 'object' && 'code' in (err as object)
}

function toSerialized(err: unknown): SerializedError {
    if (isSerializedError(err)) {
        return { code: err.code, params: err.params ?? {}, status: err.status }
    }
    const detail = err instanceof Error ? err.message : String(err)
    return { code: 'unexpected', params: { detail } }
}
