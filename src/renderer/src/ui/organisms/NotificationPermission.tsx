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

type DeliveryCheckStep = 'idle' | 'sending' | 'asking'

/**
 * Sends a test notification and asks whether it appeared: Electron reports "shown" even when the system
 * drops it, so only the user's answer proves that notifications work.
 */
function useDeliveryCheck() {
    const queryClient = useQueryClient()
    const [step, setStep] = useState<DeliveryCheckStep>('idle')

    const send = async () => {
        setStep('sending')
        await api.notifications.test()
        setStep('asking')
    }
    const answer = async (seen: boolean) => {
        const info = await api.notifications.confirm(seen)
        queryClient.setQueryData(qk.permission, info)
        setStep('idle')
    }
    return { step, send, answer }
}

function openSystemSettings() {
    void api.notifications.openSettings()
}

function DeliveryQuestion({ onAnswer }: { onAnswer: (seen: boolean) => void }) {
    const { t } = useI18n()
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm">
            <span className="flex-1">{t('permission.seenQuestion')}</span>
            <Button variant="primary" onClick={() => onAnswer(true)}>
                {t('permission.seenYes')}
            </Button>
            <Button onClick={() => onAnswer(false)}>{t('permission.seenNo')}</Button>
        </div>
    )
}

const PENDING_STATUSES: NotifyPermission[] = ['unconfirmed', 'denied']

/**
 * On app start, if notifications are not confirmed or are blocked, shows a modal that sends a test
 * and asks whether it appeared. Closes by itself once they are confirmed.
 */
export function NotificationPermissionGate() {
    const { t } = useI18n()
    const toast = useToast()
    const info = usePermission().data
    const refresh = useRefreshPermission()
    const [dismissed, setDismissed] = useState(false)
    const wasPending = useRef(false)
    const pending = Boolean(info && PENDING_STATUSES.includes(info.status))

    // Coming back from the system settings: macOS may have recorded the new choice.
    useEffect(() => {
        if (!pending || dismissed) return
        wasPending.current = true
        const onFocus = () => void refresh()
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [pending, dismissed, refresh])

    useEffect(() => {
        const justGranted = info?.status === 'granted' && wasPending.current
        if (!justGranted) return
        wasPending.current = false
        toast(t('permission.enabled'))
    }, [info, toast, t])

    if (!info || !pending || dismissed) return null
    return <PermissionDialog info={info} onClose={() => setDismissed(true)} />
}

function PermissionDialog({ info, onClose }: { info: NotifyPermissionInfo; onClose: () => void }) {
    const { t } = useI18n()
    const check = useDeliveryCheck()
    const appName = info.dev ? 'Electron' : t('app.name')
    const blocked = info.status === 'denied'
    const title = blocked ? t('permission.blockedTitle') : t('permission.confirmTitle')
    const testLabel = blocked ? t('permission.testAgain') : t('permission.sendTest')

    const footer = (
        <>
            <Button onClick={onClose}>{t('common.notNow')}</Button>
            {blocked && <Button onClick={openSystemSettings}>{t('permission.openSystemSettings')}</Button>}
            <Button variant="primary" onClick={() => void check.send()} disabled={check.step !== 'idle'}>
                <BellRing size={14} /> {testLabel}
            </Button>
        </>
    )

    return (
        <Dialog title={title} onClose={onClose} footer={footer}>
            <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    {blocked ? <BellOff size={18} /> : <BellRing size={18} />}
                </div>
                <div className="flex flex-col gap-3 text-sm leading-relaxed">
                    {blocked ? (
                        <BlockedInstructions info={info} appName={appName} />
                    ) : (
                        <p>{t('permission.confirmIntro')}</p>
                    )}
                    {check.step === 'asking' && <DeliveryQuestion onAnswer={(seen) => void check.answer(seen)} />}
                    {info.dev && <DevBuildNote signed={info.signed} />}
                </div>
            </div>
        </Dialog>
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
    unconfirmed: 'danger'
}

/** Status row on the Settings screen, with the test that confirms delivery. */
export function PermissionStatus() {
    const { t } = useI18n()
    const info = usePermission().data
    const refresh = useRefreshPermission()
    const check = useDeliveryCheck()
    if (!info) return null
    const statusLabel = t(`permission.status.${info.status}`)
    return (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-line px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
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
                    <Button onClick={() => void check.send()} disabled={check.step !== 'idle'}>
                        {t('permission.sendTest')}
                    </Button>
                </div>
            </div>
            {check.step === 'asking' && <DeliveryQuestion onAnswer={(seen) => void check.answer(seen)} />}
        </div>
    )
}
