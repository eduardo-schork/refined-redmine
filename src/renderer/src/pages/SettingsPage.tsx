import { useState, type ReactNode } from 'react'
import { Bell, Briefcase, CalendarDays, Palette, UserRound, Workflow } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { SettingsTab } from '@/lib/router'
import { NavItem } from '@/ui/molecules/NavItem'
import { AppearanceSection } from '@/ui/organisms/settings/AppearanceSection'
import { HandoffRulesSection } from '@/ui/organisms/settings/HandoffRulesSection'
import { IssueColorsSection } from '@/ui/organisms/settings/IssueColorsSection'
import { IssueStyleSection } from '@/ui/organisms/settings/IssueStyleSection'
import { MonitorsSection } from '@/ui/organisms/settings/MonitorsSection'
import { UpdatesSection } from '@/ui/organisms/settings/UpdatesSection'
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

const TAB_ICONS: Record<SettingsTab, ReactNode> = {
    general: <UserRound size={15} />,
    appearance: <Palette size={15} />,
    notifications: <Bell size={15} />,
    calendar: <CalendarDays size={15} />,
    work: <Briefcase size={15} />,
    automations: <Workflow size={15} />
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
            <MonitorsSection />
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
    automations: () => <HandoffRulesSection />
}

const TAB_ORDER: SettingsTab[] = ['general', 'appearance', 'notifications', 'calendar', 'work', 'automations']

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
