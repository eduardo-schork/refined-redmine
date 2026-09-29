import { useCallback, useState } from 'react'
import type { SettingsView } from '@contracts/api'
import type { Board } from '@domain/board/board'
import { resolveLocale } from '@shared/i18n/index'
import { useAppEventsSync } from '@/hooks/notifications'
import { useSession } from '@/hooks/session'
import { useApplyAppearance } from '@/lib/appearance'
import { I18nProvider } from '@/lib/i18n'
import { NavContext, type Route } from '@/lib/router'
import BoardPage from '@/pages/BoardPage'
import CalendarPage from '@/pages/CalendarPage'
import HomePage from '@/pages/HomePage'
import LogPage from '@/pages/LogPage'
import NotificationsPage from '@/pages/NotificationsPage'
import OnboardingPage from '@/pages/OnboardingPage'
import SettingsPage from '@/pages/SettingsPage'
import SprintsPage from '@/pages/SprintsPage'
import { ToastProvider } from '@/ui/molecules/Toast'
import { BoardEditor } from '@/ui/organisms/BoardEditor'
import { IssueModalProvider } from '@/ui/organisms/IssueModal'
import { NotificationPermissionGate } from '@/ui/organisms/NotificationPermission'
import { Sidebar } from '@/ui/organisms/Sidebar'
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
    const [route, setRoute] = useState<Route>({ page: 'home' })
    // undefined = editor closed; an object (empty or prefilled) = editor open.
    const [newBoard, setNewBoard] = useState<Partial<Board> | undefined>()
    const navigate = useCallback((nextRoute: Route) => setRoute(nextRoute), [])
    useAppEventsSync(navigate)

    const openEmptyBoardEditor = () => setNewBoard({})
    const closeBoardEditor = () => setNewBoard(undefined)
    const handleBoardSaved = (boardId: string) => {
        closeBoardEditor()
        navigate({ page: 'board', boardId })
    }

    return (
        <NavContext.Provider value={navigate}>
            <IssueModalProvider>
                <NotificationPermissionGate />
                <AppShell sidebar={<Sidebar route={route} onNavigate={navigate} onNewBoard={openEmptyBoardEditor} />}>
                    {route.page === 'home' && <HomePage />}
                    {route.page === 'calendar' && (
                        <CalendarPage
                            key={`${route.date}|${route.eventId}`}
                            focusDate={route.date}
                            focusEventId={route.eventId}
                            onGoSprints={() => navigate({ page: 'sprints' })}
                        />
                    )}
                    {route.page === 'sprints' && <SprintsPage onCreateBoard={setNewBoard} />}
                    {route.page === 'board' && (
                        <BoardPage
                            key={route.boardId}
                            boardId={route.boardId}
                            onCreate={openEmptyBoardEditor}
                            onDeleted={() => navigate({ page: 'board' })}
                        />
                    )}
                    {route.page === 'notifications' && <NotificationsPage />}
                    {route.page === 'log' && <LogPage />}
                    {route.page === 'settings' && <SettingsPage key={route.tab} tab={route.tab} />}
                </AppShell>
                {newBoard && <BoardEditor initial={newBoard} onClose={closeBoardEditor} onSaved={handleBoardSaved} />}
            </IssueModalProvider>
        </NavContext.Provider>
    )
}
