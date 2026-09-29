import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BellOff, BellRing } from 'lucide-react'
import type { NotifyPermission, NotifyPermissionInfo } from '@domain/notification/permission'
import { usePermission } from '@/hooks/notifications'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { StatusDot } from '../atoms/misc'
import { Dialog } from '../molecules/Dialog'
import { RichText } from '../molecules/RichText'
import { useToast } from '../molecules/Toast'

const isMac = navigator.userAgent.includes('Mac')

function useRefreshPermission() {
    const queryClient = useQueryClient()
    return useCallback(async () => {
        const info = await api.notifications.permission()
        queryClient.setQueryData(qk.permission, info)
        return info
    }, [queryClient])
}

/** Sends a real notification (only shown if permission is already granted) and re-reads the state. */
function useProbe() {
    const refresh = useRefreshPermission()
    return useCallback(async () => {
        await api.notifications.test()
        return refresh()
    }, [refresh])
}

function openSystemSettings() {
    void api.notifications.openSettings()
}

/**
 * On app start, checks the notification permission and, if pending or blocked, shows a modal.
 * Closes by itself once the permission is detected.
 */
export function NotificationPermissionGate() {
    const { t } = useI18n()
    const toast = useToast()
    const info = usePermission().data
    const refresh = useRefreshPermission()
    const probe = useProbe()
    const [dismissed, setDismissed] = useState(false)
    const wasPending = useRef(false)
    const pending = info && (info.status === 'not-determined' || info.status === 'denied')
    const denied = info?.status === 'denied'

    // Re-reads every 3 s; when blocked, confirms with a real notification on returning to the window.
    useEffect(() => {
        if (!pending || dismissed) return
        wasPending.current = true
        const onFocus = () => {
            if (denied) {
                void probe()
                return
            }
            void refresh()
        }
        window.addEventListener('focus', onFocus)
        const timer = setInterval(() => void refresh(), 3000)
        return () => {
            window.removeEventListener('focus', onFocus)
            clearInterval(timer)
        }
    }, [pending, dismissed, denied, probe, refresh])

    useEffect(() => {
        const justGranted = info?.status === 'granted' && wasPending.current
        if (!justGranted) return
        wasPending.current = false
        toast(t('permission.enabled'))
    }, [info, toast, t])

    if (!info || !pending || dismissed) return null
    return <PermissionDialog info={info} onClose={() => setDismissed(true)} onRefresh={refresh} onProbe={probe} />
}

function PermissionDialog({
    info,
    onClose,
    onRefresh,
    onProbe
}: {
    info: NotifyPermissionInfo
    onClose: () => void
    onRefresh: () => Promise<unknown>
    onProbe: () => Promise<unknown>
}) {
    const { t } = useI18n()
    const [asked, setAsked] = useState(false)
    const [busy, setBusy] = useState(false)
    const appName = info.dev ? 'Electron' : t('app.name')
    const notDetermined = info.status === 'not-determined'
    const canRequest = notDetermined && !asked
    const title = notDetermined ? t('permission.enableTitle') : t('permission.blockedTitle')

    async function request() {
        setBusy(true)
        await api.notifications.test()
        setAsked(true)
        setBusy(false)
        await onRefresh()
    }

    const requestButton = (
        <Button variant="primary" onClick={request} disabled={busy}>
            <BellRing size={14} /> {t('permission.request')}
        </Button>
    )
    const blockedButtons = (
        <>
            <Button onClick={() => void onProbe()}>{t('permission.checkAgain')}</Button>
            <Button variant="primary" onClick={openSystemSettings}>
                {t('permission.openSystemSettings')}
            </Button>
        </>
    )
    const footer = (
        <>
            <Button onClick={onClose}>{t('common.notNow')}</Button>
            {canRequest ? requestButton : blockedButtons}
        </>
    )

    return (
        <Dialog title={title} onClose={onClose} footer={footer}>
            <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    {notDetermined ? <BellRing size={18} /> : <BellOff size={18} />}
                </div>
                <div className="flex flex-col gap-3 text-[13px] leading-relaxed">
                    {notDetermined && <PendingMessage asked={asked} appName={appName} />}
                    {!notDetermined && <BlockedInstructions info={info} appName={appName} />}
                    {info.dev && <DevBuildNote signed={info.signed} />}
                </div>
            </div>
        </Dialog>
    )
}

function PendingMessage({ asked, appName }: { asked: boolean; appName: string }) {
    const { t } = useI18n()
    if (asked) {
        return (
            <p>
                <RichText k="permission.asked" values={{ app: appName }} />
            </p>
        )
    }
    const osName = isMac ? t('permission.osMac') : t('permission.osOther')
    return (
        <p>
            <RichText k="permission.intro" values={{ os: osName }} />
        </p>
    )
}

function DevBuildNote({ signed }: { signed: boolean }) {
    const { t } = useI18n()
    return (
        <p className="rounded-md bg-panel-2 px-3 py-2 text-xs text-muted">
            <RichText k="permission.dev" /> {!signed && t('permission.unsignedDev')}
        </p>
    )
}

function BlockedInstructions({ info, appName }: { info: NotifyPermissionInfo; appName: string }) {
    const { t } = useI18n()
    const reasonText = info.reason ? t(`notification.permission.${info.reason}`) : ''
    const detail = info.detail || reasonText
    const hasDetail = Boolean(info.reason || info.detail)

    return (
        <>
            <p>
                {t('permission.blocked')}
                {hasDetail && <span className="block text-xs text-muted">{t('permission.detail', { detail })}</span>}
            </p>
            {isMac ? (
                <ol className="list-decimal pl-5 text-muted">
                    <li>
                        <RichText k="permission.macStep1" values={{ app: appName }} />
                    </li>
                    <li>
                        <RichText k="permission.macStep2" />
                    </li>
                    <li>{t('permission.macStep3')}</li>
                </ol>
            ) : (
                <p className="text-muted">{t('permission.windows')}</p>
            )}
        </>
    )
}

const PERMISSION_TONES: Record<NotifyPermission, 'ok' | 'muted' | 'danger'> = {
    granted: 'ok',
    unsupported: 'muted',
    denied: 'danger',
    'not-determined': 'danger'
}

/** Status row on the Settings screen. */
export function PermissionStatus() {
    const { t } = useI18n()
    const info = usePermission().data
    const refresh = useRefreshPermission()
    if (!info) return null
    const statusLabel = t(`permission.status.${info.status}`)
    return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px]">
            <StatusDot tone={PERMISSION_TONES[info.status]} />
            <span>{t('permission.systemStatus', { status: statusLabel })}</span>
            <div className="ml-auto flex gap-2">
                {info.status !== 'granted' && (
                    <Button variant="ghost" onClick={openSystemSettings}>
                        {t('permission.openSettings')}
                    </Button>
                )}
                <Button variant="ghost" onClick={() => void refresh()}>
                    {t('permission.check')}
                </Button>
            </div>
        </div>
    )
}
