import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
    Bell,
    BellRing,
    CalendarDays,
    Clock,
    Flag,
    History,
    Home,
    KanbanSquare,
    ScrollText,
    Settings as SettingsIcon,
    SquareCheck,
    type LucideIcon
} from 'lucide-react'
import type { Issue } from '@domain/redmine/entities'
import { parseIssueSearch } from '@domain/redmine/issue-search'
import { isHttpUrl, RedmineLinks } from '@domain/redmine/links'
import { foldForSearch } from '@domain/shared/text'
import { useIssueSearch } from '@/hooks/issues'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { recentIssues } from '@/lib/recent-issues'
import { useNavigate, type Route } from '@/lib/router'
import type { SearchResult } from '../../molecules/SearchResultList'
import { useOpenIssue } from '../IssueModal'

const SEARCH_DELAY_MS = 250

type PageRoute = Extract<
    Route,
    { page: 'home' | 'calendar' | 'sprints' | 'time' | 'notifications' | 'monitors' | 'log' | 'settings' }
>

const PAGES: { route: PageRoute; labelKey: string; icon: LucideIcon }[] = [
    { route: { page: 'home' }, labelKey: 'nav.home', icon: Home },
    { route: { page: 'calendar' }, labelKey: 'nav.calendar', icon: CalendarDays },
    { route: { page: 'sprints' }, labelKey: 'nav.sprints', icon: Flag },
    { route: { page: 'time' }, labelKey: 'nav.time', icon: Clock },
    { route: { page: 'notifications' }, labelKey: 'nav.notifications', icon: Bell },
    { route: { page: 'monitors' }, labelKey: 'nav.monitors', icon: BellRing },
    { route: { page: 'log' }, labelKey: 'nav.log', icon: ScrollText },
    { route: { page: 'settings' }, labelKey: 'nav.settings', icon: SettingsIcon }
]

function useDebounced(value: string, delayMs: number): string {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs)
        return () => clearTimeout(timer)
    }, [value, delayMs])
    return debounced
}

function issueResult(issue: Issue, open: (id: number) => void): SearchResult {
    return {
        key: `issue-${issue.id}`,
        section: 'issues',
        icon: SquareCheck,
        label: `#${issue.id} ${issue.subject}`,
        detail: `${issue.status.name} · ${issue.project.name}`,
        run: () => open(issue.id)
    }
}

/** A pasted link to an issue of the Redmine (Slack, e-mail) is searched as "#1234", or "#1234#note-5" with a note. */
function asIssueReference(input: string, links: RedmineLinks): string {
    const trimmed = input.trim()
    if (!isHttpUrl(trimmed)) return input
    const { issueId, note } = links.resolve(trimmed)
    if (!issueId) return input
    if (!note) return `#${issueId}`
    return `#${issueId}#note-${note}`
}

function useResults(input: string, onDone: () => void) {
    const { t } = useI18n()
    const settings = useSettings()
    const navigate = useNavigate()
    const openIssue = useOpenIssue()
    const query = asIssueReference(input, new RedmineLinks(settings.baseUrl))
    const debounced = useDebounced(query, SEARCH_DELAY_MS)
    const search = useIssueSearch(debounced)
    const term = foldForSearch(query.trim())
    const reference = parseIssueSearch(debounced)
    const searching = reference.type !== 'empty'
    const referencedNote = reference.type === 'id' ? reference.note : undefined
    const referencedId = reference.type === 'id' ? reference.id : undefined

    const items = useMemo(() => {
        const goTo = (route: Route) => {
            onDone()
            navigate(route)
        }
        const open = (id: number) => {
            onDone()
            openIssue(id, id === referencedId ? referencedNote : undefined)
        }
        const matches = (label: string) => !term || foldForSearch(label).includes(term)
        const visiblePages = PAGES.filter((page) => settings.showLog || page.route.page !== 'log')
        const pages = visiblePages
            .filter((page) => matches(t(page.labelKey as 'nav.home')))
            .map<SearchResult>((page) => ({
                key: `page-${page.route.page}`,
                section: 'pages',
                icon: page.icon,
                label: t(page.labelKey as 'nav.home'),
                run: () => goTo(page.route)
            }))
        const boards = settings.boards
            .filter((board) => matches(board.name))
            .map<SearchResult>((board) => ({
                key: `board-${board.id}`,
                section: 'boards',
                icon: KanbanSquare,
                label: board.name,
                run: () => goTo({ page: 'board', boardId: board.id })
            }))
        const recent = term
            ? []
            : recentIssues().map<SearchResult>((issue) => ({
                  key: `recent-${issue.id}`,
                  section: 'recent',
                  icon: History,
                  label: `#${issue.id} ${issue.subject}`,
                  detail: issue.project,
                  run: () => open(issue.id)
              }))
        const issues = searching ? (search.data ?? []).map((issue) => issueResult(issue, open)) : []
        return [...recent, ...issues, ...boards, ...pages]
    }, [
        term,
        searching,
        search.data,
        referencedId,
        referencedNote,
        settings.boards,
        settings.showLog,
        t,
        onDone,
        navigate,
        openIssue
    ])

    const loading = searching && (search.isFetching || debounced !== query)
    return { items, loading, searchedTerm: debounced }
}

function useEmptyMessage(input: string, searchedTerm: string, loading: boolean, hasItems: boolean) {
    const { t } = useI18n()
    if (!input.trim()) return hasItems ? undefined : t('search.empty')
    if (hasItems || loading) return undefined
    const search = parseIssueSearch(searchedTerm)
    if (search.type === 'id') return t('search.idNotFound', { id: search.id })
    return t('search.noResults', { term: searchedTerm })
}

/**
 * State of a quick search field: text, results (recent issues, issues, boards, screens) and keyboard navigation.
 * `onDone` runs before a result opens; `onEscape` when Esc is pressed.
 */
export function useQuickSearch({ onDone, onEscape }: { onDone: () => void; onEscape: () => void }) {
    const [input, setInput] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const { items, loading, searchedTerm } = useResults(input, onDone)
    const message = useEmptyMessage(input, searchedTerm, loading, items.length > 0)
    const listRef = useRef<HTMLDivElement>(null)

    useEffect(() => setActiveIndex(0), [input])
    useEffect(() => {
        const active = listRef.current?.querySelector('[data-active="true"]')
        active?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex])

    const moveBy = (delta: number) => {
        if (!items.length) return
        setActiveIndex((current) => (current + delta + items.length) % items.length)
    }

    const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
        const actions: Record<string, () => void> = {
            ArrowDown: () => moveBy(1),
            ArrowUp: () => moveBy(-1),
            Enter: () => items[activeIndex]?.run(),
            Escape: onEscape
        }
        const action = actions[keyboardEvent.key]
        if (!action) return
        keyboardEvent.preventDefault()
        action()
    }

    return { input, setInput, items, loading, message, activeIndex, setActiveIndex, handleKeyDown, listRef }
}
