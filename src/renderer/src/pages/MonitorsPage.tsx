import { useI18n } from '@/lib/i18n'
import { MonitorsSection } from '@/ui/organisms/settings/MonitorsSection'
import { PageLayout } from '@/ui/templates/layouts'

/** Monitors: notifications about sets of issues, with no board needed (for example "fewer than 2 in Ana's queue"). */
export default function MonitorsPage() {
    const { t } = useI18n()
    return (
        <PageLayout title={t('nav.monitors')} width="lg">
            <MonitorsSection />
        </PageLayout>
    )
}
