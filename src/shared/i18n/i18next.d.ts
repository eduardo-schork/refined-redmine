import type { ptBR } from './locales/pt-BR'

// Typed translation keys: t('missing.key') is a compile-time error.
declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation'
        resources: { translation: typeof ptBR }
    }
}
