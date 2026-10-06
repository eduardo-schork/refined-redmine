import { useState } from 'react'
import { CheckCheck, RefreshCw, Trash2 } from 'lucide-react'
import { MINE_MONITOR_ID } from '@domain/monitor/monitor'
import type { AppNotification } from '@domain/notification/notification'
import {
    useClearNotifications,
    useMarkRead,
    useMonitorStatus,
    useNotifications,
    useRunMonitorNow
} from '@/hooks/notifications'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { openNotification, useNavigate } from '@/lib/router'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/atoms/Button'
import { IconButton } from '@/ui/atoms/IconButton'
import { useOpenIssue } from '@/ui/organisms/IssueModal'
import { NotificationList } from '@/ui/organisms/NotificationList'
import { PageLayout } from '@/ui/templates/layouts'

export default function NotificationsPage() {
    const { t, error } = useI18n()
    const navigate = useNavigate()
    const openIssue = useOpenIssue()
    const items = useNotifications().data ?? []
    const status = useMonitorStatus().data
    const markRead = useMarkRead()
    const clear = useClearNotifications()
    const runNow = useRunMonitorNow()
    const [onlyUnread, setOnlyUnread] = useState(false)
    const list = items.filter((notification) => !onlyUnread || !notification.read)
    const lastError = status?.lastError

    function open(notification: AppNotification) {
        markRead.mutate([notification.id])
        openNotification(notification, { navigate, openIssue, openExternal: (url) => void api.app.openExternal(url) })
    }

    function confirmClear() {
        if (!confirm(t('notificationsPage.confirmClear'))) return
        clear.mutate()
    }

    function lastErrorMessage(monitorError: NonNullable<typeof lastError>): string {
        if (!monitorError.context) return error(monitorError)
        const monitorName = monitorError.context === MINE_MONITOR_ID ? t('monitors.mine') : monitorError.context
        return t('notificationsPage.errorIn', { query: monitorName, message: error(monitorError) })
    }

    return (
        <PageLayout
            title={t('nav.notifications')}
            subtitle={lastError && <span className="truncate text-xs text-danger">{lastErrorMessage(lastError)}</span>}
            actions={
                <>
                    <Button variant={onlyUnread ? 'primary' : 'outline'} onClick={() => setOnlyUnread(!onlyUnread)}>
                        {t('notificationsPage.unread')}
                    </Button>
                    <Button onClick={() => runNow.mutate()} disabled={status?.running}>
                        <RefreshCw size={14} className={cn(status?.running && 'animate-spin')} />{' '}
                        {t('notificationsPage.checkNow')}
                    </Button>
                    <IconButton
                        label={t('notificationsPage.markAll')}
                        icon={<CheckCheck size={15} />}
                        onClick={() => markRead.mutate('all')}
                    />
                    <IconButton
                        label={t('notificationsPage.clear')}
                        tone="danger"
                        icon={<Trash2 size={15} />}
                        onClick={confirmClear}
                    />
                </>
            }
            width="md"
        >
            {list.length === 0 && (
                <div className="py-16 text-center text-sm text-muted">
                    {onlyUnread ? t('notificationsPage.nothingPending') : t('notificationsPage.empty')}
                </div>
            )}
            <NotificationList items={list} onOpen={open} />
        </PageLayout>
    )
}
