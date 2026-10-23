import { useCallback, useState, type ReactNode } from 'react'
import type { SettingsView } from '@contracts/api'
import type { Board } from '@domain/board/board'
import { resolveLocale } from '@shared/i18n/index'
import { useAppEventsSync } from '@/hooks/notifications'
import { useSession, useSettings } from '@/hooks/session'
import { useWorkspaceTabs } from '@/hooks/workspace'
import { useApplyAppearance } from '@/lib/appearance'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { IssueStyleContext } from '@/lib/issue-style'
import { NavContext, type NavigateOptions, type Route } from '@/lib/router'
import { useModifierShortcut, useTabShortcuts } from '@/lib/shortcuts'
import { ActiveTabContext, type WorkspaceTab } from '@/lib/workspace-tabs'
import BoardPage from '@/pages/BoardPage'
import CalendarPage from '@/pages/CalendarPage'
import HomePage from '@/pages/HomePage'
import LogPage from '@/pages/LogPage'
import NotificationsPage from '@/pages/NotificationsPage'
import OvertimePage from '@/pages/OvertimePage'
import OnboardingPage from '@/pages/OnboardingPage'
import SettingsPage from '@/pages/SettingsPage'
import SprintsPage from '@/pages/SprintsPage'
import TeamTimePage from '@/pages/TeamTimePage'
import TimePage from '@/pages/TimePage'
import { ToastProvider } from '@/ui/molecules/Toast'
import { BoardEditor } from '@/ui/organisms/BoardEditor'
import { IssueModalProvider, TabIssueModals, useOpenIssue } from '@/ui/organisms/IssueModal'
import { NotificationPermissionGate } from '@/ui/organisms/NotificationPermission'
import { QuickSearch } from '@/ui/organisms/search/QuickSearch'
import { WhatsNewDialog } from '@/ui/organisms/WhatsNewDialog'
import { Sidebar } from '@/ui/organisms/Sidebar'
import { WorkspaceTabBar } from '@/ui/organisms/WorkspaceTabBar'
import { AppShell } from '@/ui/templates/layouts'

export default function App() {
    const { data: session } = useSession()
    if (!session) return null
    return <SessionApp session={session} />
}

function SessionApp({ session }: { session: SettingsView }) {
    useApplyAppearance(session.appearance)
    const locale = resolveLocale(session.language, navigator.language)
    const isLoggedIn = session.hasApiKey && Boolean(session.user)
    return (
        <I18nProvider locale={locale}>
            <ToastProvider>{isLoggedIn ? <AuthenticatedApp /> : <OnboardingPage />}</ToastProvider>
        </I18nProvider>
    )
}

function AuthenticatedApp() {
    const settings = useSettings()
    const workspace = useWorkspaceTabs(settings.workspace, settings.boards)
    const navigate = workspace.navigate
    // undefined = editor closed; an object (empty or prefilled) = editor open.
    const [newBoard, setNewBoard] = useState<Partial<Board> | undefined>()
    const [searching, setSearching] = useState(false)
    const openSearch = useCallback(() => setSearching(true), [])
    const closeSearch = useCallback(() => setSearching(false), [])
    useModifierShortcut('k', openSearch)
    useTabShortcuts(workspace.enabled, workspace.step, workspace.selectPosition)

    const openEmptyBoardEditor = () => setNewBoard({})
    const closeBoardEditor = () => setNewBoard(undefined)
    const handleBoardSaved = (boardId: string) => {
        closeBoardEditor()
        navigate({ page: 'board', boardId })
    }
    const pageActions = { navigate, onNewBoard: openEmptyBoardEditor, onCreateBoard: setNewBoard }

    return (
        <NavContext.Provider value={navigate}>
            <IssueStyleContext.Provider value={settings.issueStyle}>
                <IssueModalProvider onOpenIssue={workspace.openIssueInFrontTab}>
                    <AppEventsSync onNavigate={navigate} />
                    <NotificationPermissionGate />
                    <WhatsNewDialog />
                    <AppShell
                        sidebar={
                            <Sidebar
                                route={workspace.activeRoute}
                                onNavigate={navigate}
                                onNewBoard={openEmptyBoardEditor}
                                onSearch={openSearch}
                            />
                        }
                    >
                        {workspace.enabled && (
                            <WorkspaceTabBar
                                tabs={workspace.tabs}
                                activeKey={workspace.activeKey}
                                actions={workspace}
                            />
                        )}
                        {workspace.tabs.length === 0 && <NoTabs />}
                        {workspace.tabs.map((tab) => (
                            <TabPanel
                                key={tab.key}
                                tab={tab}
                                active={tab.key === workspace.activeKey}
                                onOpenIssue={workspace.openIssue}
                                onCloseIssue={workspace.closeIssue}
                            >
                                <PageView route={tab.route} {...pageActions} />
                            </TabPanel>
                        ))}
                    </AppShell>
                    {newBoard && (
                        <BoardEditor initial={newBoard} onClose={closeBoardEditor} onSaved={handleBoardSaved} />
                    )}
                    {searching && <QuickSearch onClose={closeSearch} />}
                </IssueModalProvider>
            </IssueStyleContext.Provider>
        </NavContext.Provider>
    )
}

interface TabPanelProps {
    tab: WorkspaceTab
    active: boolean
    onOpenIssue: (key: string, issueId: number) => void
    onCloseIssue: (key: string) => void
    children: ReactNode
}

/**
 * Hidden tabs stay mounted (scroll, filters, forms and open dialogs are kept) but do not react to the keyboard.
 * Layout containment makes the panel the box of its `fixed` dialogs: they cover only this tab, leaving the sidebar and
 * the tab bar usable, and hide with it.
 */
function TabPanel({ tab, active, onOpenIssue, onCloseIssue, children }: TabPanelProps) {
    const panelClass = active ? 'flex min-h-0 flex-1 flex-col contain-layout' : 'hidden'
    return (
        <ActiveTabContext.Provider value={active}>
            <div className={panelClass}>
                <TabIssueModals
                    issues={tab.issues ?? []}
                    onOpenIssue={(issueId) => onOpenIssue(tab.key, issueId)}
                    onBack={() => onCloseIssue(tab.key)}
                >
                    {children}
                </TabIssueModals>
            </div>
        </ActiveTabContext.Provider>
    )
}

function NoTabs() {
    const { t } = useI18n()
    return (
        <div className="drag flex flex-1 items-start justify-center pt-[20vh] text-sm text-muted">
            {t('workspace.noTabs')}
        </div>
    )
}

interface PageActions {
    navigate: (route: Route, options?: NavigateOptions) => void
    onNewBoard: () => void
    onCreateBoard: (board: Partial<Board>) => void
}

function PageView({ route, navigate, onNewBoard, onCreateBoard }: { route: Route } & PageActions) {
    switch (route.page) {
        case 'home':
            return <HomePage />
        case 'calendar':
            return (
                <CalendarPage
                    key={`${route.date}|${route.eventId}`}
                    focusDate={route.date}
                    focusEventId={route.eventId}
                    onGoSprints={() => navigate({ page: 'sprints' })}
                />
            )
        case 'sprints':
            return <SprintsPage onCreateBoard={onCreateBoard} />
        case 'board':
            return (
                <BoardPage
                    key={route.boardId}
                    boardId={route.boardId}
                    onCreate={onNewBoard}
                    onDeleted={() => navigate({ page: 'board' })}
                />
            )
        case 'notifications':
            return <NotificationsPage />
        case 'log':
            return <LogPage />
        case 'time':
            return <TimePage />
        case 'overtime':
            return <OvertimePage />
        case 'team':
            return <TeamTimePage />
        case 'settings':
            return <SettingsPage key={route.tab} tab={route.tab} />
    }
}

/** Inside the issue modal provider: a click on a system notification about an issue opens it in the modal. */
function AppEventsSync({ onNavigate }: { onNavigate: (route: Route, options?: NavigateOptions) => void }) {
    const openIssue = useOpenIssue()
    useAppEventsSync(onNavigate, openIssue)
    return null
}
