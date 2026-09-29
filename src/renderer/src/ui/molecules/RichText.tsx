import { Trans } from 'react-i18next'

/** Keys with simple markup (<b>) in the locale files. */
export type RichKey =
    | 'onboarding.apiKeyHint'
    | 'sprints.setup.convention'
    | 'calendar.shortcuts'
    | 'permission.intro'
    | 'permission.asked'
    | 'permission.macStep1'
    | 'permission.macStep2'
    | 'permission.dev'

export function RichText({ k, values }: { k: RichKey; values?: Record<string, string | number> }) {
    // Typing <Trans> over all keys exceeds the TypeScript limit; `k` is already constrained above.
    return <Trans i18nKey={k as never} values={values} components={{ b: <b className="text-fg" /> }} />
}
