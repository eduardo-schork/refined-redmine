import { type FormEvent, useEffect, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, ExternalLink, Loader2, Plug } from 'lucide-react'
import { hostOf, prepareBaseUrl } from '@domain/redmine/connection'
import { isHttpUrl } from '@domain/redmine/links'
import type { ErrorCode } from '@domain/shared/errors'
import { useLogin } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/fields'
import { IconButton } from '../atoms/IconButton'
import { TextLink } from '../atoms/misc'
import { Field } from '../molecules/Field'
import { RichText } from '../molecules/RichText'

/** After this long without an answer the screen explains what may be holding the connection. */
const SLOW_AFTER_SECONDS = 8

/** What to do about each connection failure; codes not listed only show the message. */
const SUGGESTIONS: Partial<Record<ErrorCode, string>> = {
    'auth.invalidKey': 'onboarding.suggestion.invalidKey',
    'auth.notRedmine': 'onboarding.suggestion.notRedmine',
    'auth.apiDisabled': 'onboarding.suggestion.apiDisabled',
    'auth.invalidUrl': 'onboarding.suggestion.notRedmine',
    'network.dns': 'onboarding.suggestion.network',
    'network.unreachable': 'onboarding.suggestion.network',
    'network.refused': 'onboarding.suggestion.network',
    'network.timeout': 'onboarding.suggestion.timeout',
    'network.tls': 'onboarding.suggestion.tls',
    'network.proxy': 'onboarding.suggestion.tls',
    'network.reset': 'onboarding.suggestion.tls'
}

function useElapsedSeconds(running: boolean): number {
    const [seconds, setSeconds] = useState(0)
    useEffect(() => {
        setSeconds(0)
        if (!running) return
        const startedAt = Date.now()
        const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250)
        return () => clearInterval(timer)
    }, [running])
    return seconds
}

const errorCodeOf = (failure: unknown) =>
    (failure && typeof failure === 'object' && 'code' in failure ? failure.code : 'unexpected') as ErrorCode

/** Redmine address and API key, with feedback while connecting and an explanation when it fails. */
export function ConnectionForm({ lastBaseUrl }: { lastBaseUrl?: string }) {
    const { t } = useI18n()
    const login = useLogin()
    const [typedUrl, setTypedUrl] = useState(lastBaseUrl ?? '')
    const [apiKey, setApiKey] = useState('')
    const connecting = login.isPending
    const preparedUrl = prepareBaseUrl(typedUrl)
    const validUrl = isHttpUrl(preparedUrl)
    const adjusted = validUrl && preparedUrl !== typedUrl.trim()

    // An error from the previous attempt no longer applies once the address or the key changes.
    const editUrl = (value: string) => {
        setTypedUrl(value)
        login.reset()
    }
    const editKey = (value: string) => {
        setApiKey(value)
        login.reset()
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (connecting) return
        login.mutate({ baseUrl: preparedUrl, apiKey })
    }

    const openMyAccount = () => void api.app.openExternal(`${preparedUrl}/my/account`)

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-line bg-panel p-7 shadow-sm">
            <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Plug size={20} />
                </span>
                <div>
                    <h1 className="text-xl font-semibold">{t('app.name')}</h1>
                    <p className="text-sm text-muted">{t('onboarding.subtitle')}</p>
                </div>
            </div>

            <fieldset disabled={connecting} className="mt-6 flex flex-col gap-4">
                <Field
                    label={t('onboarding.url')}
                    hint={adjusted ? t('onboarding.urlPreview', { url: preparedUrl }) : undefined}
                >
                    <Input
                        autoFocus={!lastBaseUrl}
                        required
                        inputMode="url"
                        placeholder={t('onboarding.urlPlaceholder')}
                        value={typedUrl}
                        onChange={(event) => editUrl(event.target.value)}
                    />
                </Field>
                <ApiKeyField value={apiKey} autoFocus={Boolean(lastBaseUrl)} onChange={editKey} />
                {validUrl && (
                    <TextLink className="-mt-2 self-start text-xs" onClick={openMyAccount}>
                        <ExternalLink size={12} /> {t('onboarding.openMyAccount')}
                    </TextLink>
                )}
            </fieldset>

            <div className="mt-5 flex flex-col gap-3">
                <Button variant="primary" type="submit" disabled={connecting} className="h-10">
                    {connecting && <Loader2 size={16} className="animate-spin" />}
                    {connecting ? t('onboarding.connecting') : t('onboarding.connect')}
                </Button>
                {connecting && <ConnectingStatus url={preparedUrl} />}
                {login.isError && !connecting && <ConnectionError failure={login.error} />}
            </div>
        </form>
    )
}

function ApiKeyField({
    value,
    autoFocus,
    onChange
}: {
    value: string
    autoFocus: boolean
    onChange: (value: string) => void
}) {
    const { t } = useI18n()
    const [showKey, setShowKey] = useState(false)
    return (
        <Field label={t('onboarding.apiKey')} hint={<RichText k="onboarding.apiKeyHint" />}>
            <div className="flex items-center gap-2">
                <Input
                    autoFocus={autoFocus}
                    required
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 font-mono"
                    placeholder="••••••••••••••••"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                <IconButton
                    label={showKey ? t('onboarding.hideKey') : t('onboarding.showKey')}
                    icon={showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    onClick={() => setShowKey((shown) => !shown)}
                />
            </div>
        </Field>
    )
}

function ConnectingStatus({ url }: { url: string }) {
    const { t } = useI18n()
    const seconds = useElapsedSeconds(true)
    const slow = seconds >= SLOW_AFTER_SECONDS
    return (
        <div role="status" aria-live="polite" className="rounded-lg bg-panel-2 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2">
                <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
                <span className="min-w-0 flex-1 truncate">{t('onboarding.connectingTo', { host: hostOf(url) })}</span>
                <span className="shrink-0 tabular-nums text-muted">{t('onboarding.elapsed', { seconds })}</span>
            </div>
            {slow && <p className="mt-1.5 text-xs text-muted">{t('onboarding.slow')}</p>}
        </div>
    )
}

function ConnectionError({ failure }: { failure: unknown }) {
    const { t, error } = useI18n()
    const suggestion = SUGGESTIONS[errorCodeOf(failure)]
    return (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm">
            <div className="flex items-start gap-2 text-danger">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span className="font-medium">{error(failure)}</span>
            </div>
            {suggestion && <p className="mt-1.5 pl-[23px] text-xs text-fg/85">{t(suggestion as 'onboarding.slow')}</p>}
        </div>
    )
}
