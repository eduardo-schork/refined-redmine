import { type FormEvent, useState } from 'react'
import { useLogin } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/ui/atoms/Button'
import { Input } from '@/ui/atoms/fields'
import { Field } from '@/ui/molecules/Field'
import { RichText } from '@/ui/molecules/RichText'
import { Alert } from '@/ui/molecules/surfaces'
import { CenteredLayout } from '@/ui/templates/layouts'

export default function OnboardingPage() {
    const { t, error } = useI18n()
    const login = useLogin()
    const [baseUrl, setBaseUrl] = useState('')
    const [apiKey, setApiKey] = useState('')

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        login.mutate({ baseUrl, apiKey })
    }

    return (
        <CenteredLayout>
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm rounded-2xl border border-line bg-panel p-7 shadow-sm"
            >
                <h1 className="text-lg font-semibold">{t('app.name')}</h1>
                <p className="mt-1 text-[13px] text-muted">{t('onboarding.subtitle')}</p>
                <div className="mt-6 flex flex-col gap-4">
                    <Field label={t('onboarding.url')}>
                        <Input
                            autoFocus
                            required
                            placeholder={t('onboarding.urlPlaceholder')}
                            value={baseUrl}
                            onChange={(event) => setBaseUrl(event.target.value)}
                        />
                    </Field>
                    <Field label={t('onboarding.apiKey')} hint={<RichText k="onboarding.apiKeyHint" />}>
                        <Input
                            required
                            type="password"
                            placeholder="••••••••••••••••"
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                        />
                    </Field>
                    {login.isError && <Alert className="px-3 py-2">{error(login.error)}</Alert>}
                    <Button variant="primary" type="submit" disabled={login.isPending} className="h-9">
                        {login.isPending ? t('onboarding.connecting') : t('onboarding.connect')}
                    </Button>
                </div>
            </form>
        </CenteredLayout>
    )
}
