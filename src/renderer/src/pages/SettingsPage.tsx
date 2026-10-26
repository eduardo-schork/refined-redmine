import { useState, type ReactNode } from 'react'
import { Archive, Bell, Briefcase, CalendarDays, Palette, UserRound, Workflow } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useNavigate, type SettingsTab } from '@/lib/router'
import { Button } from '@/ui/atoms/Button'
import { Card } from '@/ui/molecules/surfaces'
import { NavItem } from '@/ui/molecules/NavItem'
import { AppearanceSection } from '@/ui/organisms/settings/AppearanceSection'
import { BackupSection } from '@/ui/organisms/settings/BackupSection'
import { ClaudeActionsSection } from '@/ui/organisms/settings/ClaudeActionsSection'
import { HandoffRulesSection } from '@/ui/organisms/settings/HandoffRulesSection'
import { IssueColorsSection } from '@/ui/organisms/settings/IssueColorsSection'
import { IssueStyleSection } from '@/ui/organisms/settings/IssueStyleSection'
import { UpdatesSection } from '@/ui/organisms/settings/UpdatesSection'
import { WorkTimeSection } from '@/ui/organisms/settings/WorkTimeSection'
import {
    AboutSection,
    AccountSection,
    CalendarSection,
    DiagnosticsSection,
    HomeSection,
    LanguageSection,
    WorkspaceSection,
    MonitoringSection,
    ScheduleSection,
    SprintsSection
} from '@/ui/organisms/settings/sections'
import { PageLayout } from '@/ui/templates/layouts'

/** Monitors moved to their own screen (sidebar): this card points there. */
function MonitorsLink() {
    const { t } = useI18n()
    const navigate = useNavigate()
    return (
        <Card
            title={t('nav.monitors')}
            description={t('monitors.movedHint')}
            actions={<Button onClick={() => navigate({ page: 'monitors' })}>{t('monitors.open')}</Button>}
        >
            {null}
        </Card>
    )
}

const TAB_ICONS: Record<SettingsTab, ReactNode> = {
    general: <UserRound size={15} />,
    appearance: <Palette size={15} />,
    notifications: <Bell size={15} />,
    calendar: <CalendarDays size={15} />,
    work: <Briefcase size={15} />,
    automations: <Workflow size={15} />,
    backup: <Archive size={15} />
}

const TAB_SECTIONS: Record<SettingsTab, () => ReactNode> = {
    general: () => (
        <>
            <AccountSection />
            <LanguageSection />
            <WorkspaceSection />
            <AboutSection />
            <UpdatesSection />
            <DiagnosticsSection />
        </>
    ),
    appearance: () => (
        <>
            <AppearanceSection />
            <IssueColorsSection />
            <IssueStyleSection />
        </>
    ),
    notifications: () => (
        <>
            <MonitoringSection />
            <MonitorsLink />
            <ScheduleSection />
        </>
    ),
    calendar: () => <CalendarSection />,
    work: () => (
        <>
            <SprintsSection />
            <HomeSection />
        </>
    ),
    automations: () => (
        <>
            <HandoffRulesSection />
            <ClaudeActionsSection />
            <WorkTimeSection />
        </>
    ),
    backup: () => <BackupSection />
}

const TAB_ORDER: SettingsTab[] = ['general', 'appearance', 'notifications', 'calendar', 'work', 'automations', 'backup']

export default function SettingsPage({ tab = 'general' }: { tab?: SettingsTab }) {
    const { t } = useI18n()
    const [current, setCurrent] = useState<SettingsTab>(tab)
    return (
        <PageLayout title={t('nav.settings')}>
            <div className="flex min-h-0 flex-1">
                <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-line p-3">
                    {TAB_ORDER.map((candidate) => (
                        <NavItem
                            key={candidate}
                            active={current === candidate}
                            onClick={() => setCurrent(candidate)}
                            icon={TAB_ICONS[candidate]}
                        >
                            {t(`settings.tab.${candidate}`)}
                        </NavItem>
                    ))}
                </nav>
                <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-5">{TAB_SECTIONS[current]()}</div>
                </div>
            </div>
        </PageLayout>
    )
}
