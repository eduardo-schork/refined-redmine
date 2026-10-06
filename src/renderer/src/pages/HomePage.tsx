import { useQueryClient } from '@tanstack/react-query'
import type { AppNotification } from '@domain/notification/notification'
import { unreadCount, useNotifications } from '@/hooks/notifications'
import { useSettings } from '@/hooks/session'
import { useSprints } from '@/hooks/sprints'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { useI18n } from '@/lib/i18n'
import { openNotification, useNavigate } from '@/lib/router'
import { TextLink } from '@/ui/atoms/misc'
import { RefreshButton } from '@/ui/molecules/RefreshButton'
import { SectionTitle } from '@/ui/molecules/surfaces'
import { LatestNotifications, QueuePanels, QueueTiles, TodayAgenda } from '@/ui/organisms/HomePanels'
import { useOpenIssue } from '@/ui/organisms/IssueModal'
import { HomeSearch } from '@/ui/organisms/search/HomeSearch'
import { SprintCard } from '@/ui/organisms/SprintCard'
import { PageLayout } from '@/ui/templates/layouts'

function greetingKey(hour: number) {
    if (hour < 12) return 'home.helloMorning'
    if (hour < 18) return 'home.helloAfternoon'
    return 'home.helloEvening'
}

export default function HomePage() {
    const { t, dates } = useI18n()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const openIssue = useOpenIssue()
    const settings = useSettings()
    const sprints = useSprints()
    const notifications = useNotifications().data ?? []
    const hello = greetingKey(new Date().getHours())
    const showSprintSetup = !sprints.configured && !sprints.isLoading
    const startedSprints = sprints.active.filter((sprint) => sprint.phase !== 'planned')
    const goToSprints = () => navigate({ page: 'sprints' })

    function refresh() {
        return Promise.all([queryClient.invalidateQueries({ queryKey: qk.myQueue }), sprints.refetch()])
    }

    function open(notification: AppNotification) {
        openNotification(notification, { navigate, openIssue, openExternal: (url) => void api.app.openExternal(url) })
    }

    return (
        <PageLayout
            title={t('nav.home')}
            width="xl"
            actions={<RefreshButton spinning={sprints.isFetching} onClick={() => void refresh()} />}
        >
            <div>
                <h2 className="text-2xl font-semibold">{t(hello, { name: settings.user?.firstname ?? '' })}</h2>
                <p className="text-sm text-muted first-letter:uppercase">
                    {dates.format(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            <HomeSearch />

            <QueueTiles
                unread={unreadCount(notifications)}
                onGoNotifications={() => navigate({ page: 'notifications' })}
            />

            <section>
                <SectionTitle
                    action={
                        <TextLink className="text-xs" onClick={goToSprints}>
                            {t('home.seeSprints')}
                        </TextLink>
                    }
                >
                    {t('home.sprints')}
                </SectionTitle>
                {showSprintSetup ? (
                    <button
                        onClick={goToSprints}
                        className="w-full cursor-default rounded-xl border border-dashed border-line p-5 text-sm text-muted hover:text-fg"
                    >
                        {t('home.configureSprints')}
                    </button>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                        {sprints.isLoading && <div className="text-sm text-muted">{t('common.loading')}</div>}
                        {startedSprints.map((sprint) => (
                            <SprintCard key={sprint.version.id} sprint={sprint} onOpen={goToSprints} compact />
                        ))}
                    </div>
                )}
            </section>

            <TodayAgenda />
            <QueuePanels />
            <LatestNotifications
                items={notifications}
                onOpen={open}
                onSeeAll={() => navigate({ page: 'notifications' })}
            />
        </PageLayout>
    )
}
