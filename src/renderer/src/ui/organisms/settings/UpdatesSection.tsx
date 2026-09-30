import { useMemo, useState } from 'react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import type { UpdateStatus } from '@domain/update/release'
import { RedmineLinks } from '@domain/redmine/links'
import { useAppInfo } from '@/hooks/app-info'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { useCheckForUpdates, useDownloadUpdate, useSaveUpdateToken, useUpdateStatus } from '@/hooks/updates'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/fields'
import { ProgressBar, TextLink } from '../../atoms/misc'
import { Field, ToggleField } from '../../molecules/Field'
import { Markdown } from '../../molecules/Markdown'
import { Card } from '../../molecules/surfaces'
import { useOpenIssue } from '../IssueModal'

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

const openExternal = (url: string) => void api.app.openExternal(url)

export function UpdatesSection() {
    const { t } = useI18n()
    const status = useUpdateStatus().data
    const settings = useSettings()
    const updateSettings = useUpdateSettings()
    if (!status) return null

    const saveAutoCheck = (autoCheck: boolean) => updateSettings.mutate({ updates: { ...settings.updates, autoCheck } })

    return (
        <Card title={t('updates.title')} description={t('updates.hint')}>
            <div className="flex flex-col gap-4">
                <UpdateStatusRow status={status} />
                <UpdateActions status={status} />
                <TokenFields hasToken={status.hasToken} />
                <ToggleField
                    checked={settings.updates.autoCheck}
                    onChange={saveAutoCheck}
                    label={t('updates.autoCheck')}
                    description={t('updates.autoCheckHint')}
                />
            </div>
        </Card>
    )
}

function usePhaseText(status: UpdateStatus): string {
    const { t, error } = useI18n()
    const version = status.latest?.version ?? ''
    const percent = Math.round((status.progress ?? 0) * 100)
    const message = status.error ? error(status.error) : ''
    return t(`updates.phase.${status.phase}`, { version, percent, message })
}

function UpdateStatusRow({ status }: { status: UpdateStatus }) {
    const { t, dates } = useI18n()
    const check = useCheckForUpdates()
    const phaseText = usePhaseText(status)
    const busy = status.phase === 'checking' || status.phase === 'downloading'
    const checkedAt = status.checkedAt ? dates.relativeTime(status.checkedAt, new Date()) : undefined
    const hasError = status.phase === 'error'

    return (
        <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
                <div className="text-xs text-muted">{t('updates.current', { version: status.currentVersion })}</div>
                <div className={cn(hasError && 'text-danger')}>{phaseText}</div>
                {checkedAt && <div className="text-xs text-muted">{t('updates.checkedAt', { time: checkedAt })}</div>}
            </div>
            <Button onClick={() => check.mutate()} disabled={!status.hasToken || busy}>
                <RefreshCw size={14} className={cn(status.phase === 'checking' && 'animate-spin')} />{' '}
                {t('updates.checkNow')}
            </Button>
        </div>
    )
}

function UpdateActions({ status }: { status: UpdateStatus }) {
    const latest = status.latest
    const showsRelease = latest && ['available', 'downloading', 'ready'].includes(status.phase)
    if (!showsRelease) return null
    return (
        <div className="flex flex-col gap-3 rounded-lg bg-accent-soft p-3">
            <DownloadOrInstall status={status} />
            <ReleaseNotes status={status} />
        </div>
    )
}

function DownloadOrInstall({ status }: { status: UpdateStatus }) {
    const { t } = useI18n()
    const download = useDownloadUpdate()
    const info = useAppInfo().data
    const version = status.latest?.version ?? ''
    const isWindows = info?.platform === 'win32'

    if (status.phase === 'downloading') return <ProgressBar value={(status.progress ?? 0) * 100} />
    if (status.phase === 'ready') {
        return (
            <div className="flex items-center gap-3">
                <Button variant="primary" onClick={() => void api.updates.install()}>
                    {isWindows ? t('updates.installWindows') : t('updates.installMac')}
                </Button>
                <span className="text-xs text-muted">
                    {isWindows ? t('updates.installWindowsHint') : t('updates.installMacHint')}
                </span>
            </div>
        )
    }
    return (
        <div>
            <Button variant="primary" onClick={() => download.mutate()} disabled={download.isPending}>
                <Download size={14} /> {t('updates.download', { version })}
            </Button>
        </div>
    )
}

function ReleaseNotes({ status }: { status: UpdateStatus }) {
    const { t } = useI18n()
    const settings = useSettings()
    const openIssue = useOpenIssue()
    const links = useMemo(() => new RedmineLinks(settings.baseUrl), [settings.baseUrl])
    const latest = status.latest
    if (!latest) return null
    return (
        <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
                {t('updates.releaseNotes', { version: latest.version })}
                <TextLink onClick={() => openExternal(latest.pageUrl)}>
                    <ExternalLink size={11} /> {t('updates.viewOnGithub')}
                </TextLink>
            </div>
            {latest.notes && (
                <Markdown text={latest.notes} links={links} onIssue={openIssue} onExternal={openExternal} />
            )}
        </div>
    )
}

type TestResult = { ok: true; text: string } | { ok: false; text: string }

function TokenFields({ hasToken }: { hasToken: boolean }) {
    const { t, error } = useI18n()
    const saveToken = useSaveUpdateToken()
    const [token, setToken] = useState('')
    const [result, setResult] = useState<TestResult>()

    async function test() {
        try {
            const { latestVersion } = await api.updates.testToken(token)
            const text = latestVersion ? t('updates.testOk', { version: latestVersion }) : t('updates.testNoRelease')
            setResult({ ok: true, text })
        } catch (testError) {
            setResult({ ok: false, text: error(testError) })
        }
    }

    const save = () => {
        saveToken.mutate(token)
        setToken('')
        setResult(undefined)
    }
    const remove = () => {
        if (confirm(t('updates.confirmRemove'))) saveToken.mutate(null)
    }

    if (hasToken) {
        return (
            <div className="flex items-center gap-3 text-sm">
                <span className="text-ok">● {t('updates.tokenSaved')}</span>
                <Button variant="danger" onClick={remove}>
                    {t('updates.remove')}
                </Button>
            </div>
        )
    }

    const hint = result ? (
        <span className={result.ok ? 'text-ok' : 'text-danger'}>{result.text}</span>
    ) : (
        t('updates.tokenHint')
    )
    return (
        <Field label={t('updates.token')} hint={hint}>
            <div className="flex items-center gap-2">
                <Input
                    type="password"
                    className="flex-1 font-mono"
                    value={token}
                    placeholder={t('updates.tokenPlaceholder')}
                    onChange={(event) => setToken(event.target.value)}
                />
                <Button onClick={() => void test()} disabled={!token.trim()}>
                    {t('updates.test')}
                </Button>
                <Button variant="primary" onClick={save} disabled={!token.trim()}>
                    {t('updates.save')}
                </Button>
            </div>
            <TextLink onClick={() => openExternal(NEW_TOKEN_URL)}>{t('updates.createToken')}</TextLink>
        </Field>
    )
}
