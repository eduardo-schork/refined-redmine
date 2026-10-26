import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
    type RefObject
} from 'react'
import { ArrowDownUp, Copy, ExternalLink, Pencil, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { CustomFieldValue, IssueDetail, Journal, JournalDetail } from '@domain/redmine/entities'
import { COPY_FORMATS, copyText } from '@domain/redmine/issue-copy'
import { MAX_SUBJECT_LENGTH, subtaskDefaults, type NewIssueDefaults } from '@domain/redmine/issue-edit'
import { RedmineLinks } from '@domain/redmine/links'
import { useChangeIssueStatus, useCommentAndChange, useIssue } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { useSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { loadJournalOrder, saveJournalOrder, type JournalOrder } from '@/lib/journal-order'
import { qk } from '@/lib/query-keys'
import { rememberIssue } from '@/lib/recent-issues'
import { SUBMIT_SHORTCUT, useModifierShortcut } from '@/lib/shortcuts'
import { useIsActiveTab } from '@/lib/workspace-tabs'
import { Avatar } from '../atoms/Avatar'
import { Button } from '../atoms/Button'
import { Input, Select } from '../atoms/fields'
import { IconButton } from '../atoms/IconButton'
import { LoadingBar } from '../atoms/LoadingBar'
import { Overline } from '../atoms/misc'
import { ClampedContent } from '../molecules/ClampedContent'
import { CopyButton, useCopy } from '../molecules/CopyButton'
import { Dialog } from '../molecules/Dialog'
import { Markdown } from '../molecules/Markdown'
import { Menu } from '../molecules/Menu'
import { RefreshButton } from '../molecules/RefreshButton'
import { inlineAttachmentRenderer } from './attachments/InlineAttachment'
import { Alert, Property } from '../molecules/surfaces'
import { useToast } from '../molecules/Toast'
import { IssueCreateDialog, useChosenFiles } from './IssueCreateDialog'
import { MarkdownEditor } from './MarkdownEditor'
import { IssueFieldEditors, useSaveField } from './IssueFieldEditors'
import { DueChip, PriorityChip, TrackerLabel, VersionChip } from '../molecules/issue-chips'
import { IssueDetailTabs } from './IssueDetailTabs'
import { IssueQuickActions } from './IssueQuickActions'
import { SendNoteButton } from './handoff/HandoffButtons'
import { CommentWithFiles } from './handoff/HandoffParts'
import { StatusTag } from '../molecules/StatusTag'

type Translate = ReturnType<typeof useI18n>['t']

// Long descriptions are cut here, so the tabs (related issues, attachments, time) show up without scrolling.
const DESCRIPTION_VISIBLE_LINES = 25

interface MarkdownLinkProps {
    links: RedmineLinks
    onIssue: (id: number) => void
    onExternal: (url: string) => void
    renderImage?: (source: string, alt: string) => ReactNode
}

// Any screen can open the modal with openIssue(id); opened issues form a stack so "← back" returns to the previous one.
// Inside a tab it opens in that tab's modal; outside (sidebar, search, system notifications), in the tab in front.
const OpenIssueContext = createContext<(id: number) => void>(() => {})
export const useOpenIssue = () => useContext(OpenIssueContext)

// Any screen can open the "New issue" form; the created issue then opens in the modal. Without defaults, the form
// starts with the ones of the screen being shown (a board's project and sprint).
const NewIssueContext = createContext<(defaults?: NewIssueDefaults) => void>(() => {})
export const useNewIssue = () => useContext(NewIssueContext)

const ScreenDefaultsContext = createContext<(defaults?: NewIssueDefaults) => void>(() => {})

type NewIssueOpener = (defaults?: NewIssueDefaults) => void
const FrontTabNewIssueContext = createContext<RefObject<NewIssueOpener | undefined>>({ current: undefined })

/** Project and sprint for issues created while this screen is shown (⌘N and the sidebar button). */
export function useScreenIssueDefaults({ projectId, fixedVersionId }: NewIssueDefaults) {
    const register = useContext(ScreenDefaultsContext)
    useEffect(() => {
        register({ projectId, fixedVersionId })
        return () => register(undefined)
    }, [register, projectId, fixedVersionId])
}

/** Outside the tabs: issues and the "New issue" form (also ⌘N) open in the tab in front. */
export function IssueModalProvider({
    onOpenIssue,
    children
}: {
    onOpenIssue: (id: number) => void
    children: ReactNode
}) {
    const frontTabNewIssue = useRef<NewIssueOpener>(undefined)
    const openNewIssue = useCallback((defaults?: NewIssueDefaults) => frontTabNewIssue.current?.(defaults), [])
    useModifierShortcut('n', openNewIssue)
    return (
        <FrontTabNewIssueContext.Provider value={frontTabNewIssue}>
            <OpenIssueContext.Provider value={onOpenIssue}>
                <NewIssueContext.Provider value={openNewIssue}>{children}</NewIssueContext.Provider>
            </OpenIssueContext.Provider>
        </FrontTabNewIssueContext.Provider>
    )
}

/** While this tab is in front, the "New issue" opened outside the tabs is this tab's. */
function useFrontTabNewIssue(openNewIssue: NewIssueOpener) {
    const isActiveTab = useIsActiveTab()
    const frontTabNewIssue = useContext(FrontTabNewIssueContext)
    useEffect(() => {
        if (!isActiveTab) return
        frontTabNewIssue.current = openNewIssue
        return () => {
            if (frontTabNewIssue.current === openNewIssue) frontTabNewIssue.current = undefined
        }
    }, [isActiveTab, frontTabNewIssue, openNewIssue])
}

/**
 * The issue modal and "New issue" form of one tab. They are hidden with the tab and come back as they were, so each
 * tab can have its own issue open. `issues` is the tab's stack, oldest first.
 */
export function TabIssueModals({
    issues,
    onOpenIssue,
    onBack,
    children
}: {
    issues: number[]
    onOpenIssue: (id: number) => void
    onBack: () => void
    children: ReactNode
}) {
    const [newIssue, setNewIssue] = useState<NewIssueDefaults>()
    const screenDefaults = useRef<NewIssueDefaults>(undefined)
    const current = issues.at(-1)
    const registerScreenDefaults = useCallback((defaults?: NewIssueDefaults) => {
        screenDefaults.current = defaults
    }, [])
    const openNewIssue = useCallback((defaults?: NewIssueDefaults) => {
        setNewIssue(defaults ?? screenDefaults.current ?? {})
    }, [])
    useFrontTabNewIssue(openNewIssue)
    return (
        <OpenIssueContext.Provider value={onOpenIssue}>
            <NewIssueContext.Provider value={openNewIssue}>
                <ScreenDefaultsContext.Provider value={registerScreenDefaults}>
                    {children}
                </ScreenDefaultsContext.Provider>
                {current !== undefined && (
                    <IssueModal key={current} id={current} canGoBack={issues.length > 1} onClose={onBack} />
                )}
                {newIssue && (
                    <IssueCreateDialog
                        defaults={newIssue}
                        onClose={() => setNewIssue(undefined)}
                        onCreated={onOpenIssue}
                    />
                )}
            </NewIssueContext.Provider>
        </OpenIssueContext.Provider>
    )
}

function openExternal(url: string) {
    void api.app.openExternal(url)
}

function IssueModal({ id, onClose, canGoBack }: { id: number; onClose: () => void; canGoBack: boolean }) {
    const { t, error } = useI18n()
    const toast = useToast()
    const openIssue = useOpenIssue()
    const openNewIssue = useNewIssue()
    const settings = useSettings()
    const links = new RedmineLinks(settings.baseUrl)
    const issueQuery = useIssue(id)
    const statuses = useStatuses()
    const changeStatus = useChangeIssueStatus(id)
    const comment = useCommentAndChange()
    const queryClient = useQueryClient()
    const issue = issueQuery.data
    useEffect(() => {
        if (issue) rememberIssue({ id: issue.id, subject: issue.subject, project: issue.project.name })
    }, [issue])
    const statusName = new Map((statuses.data ?? []).map((status) => [status.id, status.name]))
    const saving = changeStatus.isPending || comment.isPending
    const markdownLinks: MarkdownLinkProps = {
        links,
        onIssue: openIssue,
        onExternal: openExternal,
        renderImage: issue ? inlineAttachmentRenderer(issue.attachments, links) : undefined
    }

    // Agents may change the issue in Redmine: this reads it again (with its related issues and hours).
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: qk.issue(id) })
        void queryClient.invalidateQueries({ queryKey: qk.issueTime(id) })
    }

    const handleStatusChange = (statusId: number) => {
        changeStatus.mutate(statusId, {
            onSuccess: () => toast(t('issue.statusChanged', { status: statusName.get(statusId) ?? statusId })),
            onError: (mutationError) => toast(error(mutationError), 'error')
        })
    }

    return (
        <Dialog onClose={onClose} size="xl" bare title={issue?.subject} resizeKey="issue">
            <IssueHeader
                id={id}
                issue={issue}
                isError={issueQuery.isError}
                canGoBack={canGoBack}
                onClose={onClose}
                issueUrl={links.issue(id)}
                onOpenInRedmine={() => openExternal(links.issue(id))}
                refreshing={issueQuery.isFetching}
                onRefresh={refresh}
            />

            {issueQuery.isError && <Alert className="m-5">{error(issueQuery.error)}</Alert>}

            {issue && (
                <div className="flex min-h-0 flex-1">
                    <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
                        <DescriptionSection issue={issue} {...markdownLinks} />
                        <IssueDetailTabs
                            key={issue.id}
                            issue={issue}
                            links={links}
                            onOpenIssue={openIssue}
                            onNewSubtask={() => openNewIssue(subtaskDefaults(issue))}
                        />
                        <History
                            issue={issue}
                            statusName={statusName}
                            composer={<CommentBox issue={issue} comment={comment} saving={saving} />}
                            {...markdownLinks}
                        />
                    </div>

                    <IssueSidebar issue={issue} saving={saving} onStatus={handleStatusChange} />
                </div>
            )}
        </Dialog>
    )
}

function IssueHeader({
    id,
    issue,
    isError,
    canGoBack,
    onClose,
    issueUrl,
    onOpenInRedmine,
    refreshing,
    onRefresh
}: {
    id: number
    issue?: IssueDetail
    isError: boolean
    canGoBack: boolean
    onClose: () => void
    issueUrl: string
    onOpenInRedmine: () => void
    refreshing: boolean
    onRefresh: () => void
}) {
    const { t } = useI18n()
    const openIssue = useOpenIssue()
    const parent = issue?.parent
    const placeholderTitle = isError ? t('issue.loadError') : t('common.loading')

    return (
        <header className="relative flex items-start gap-3 border-b border-line px-5 py-3">
            <LoadingBar active={refreshing} className="absolute inset-x-0 -bottom-px" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                    {canGoBack && (
                        <button className="mr-1 hover:text-fg" onClick={onClose}>
                            ← {t('common.back')}
                        </button>
                    )}
                    {issue && <TrackerLabel tracker={issue.tracker} />}
                    <span className="font-medium">#{id}</span>
                    {issue && <CopyMenu issue={issue} url={issueUrl} />}
                    {issue && <span>· {issue.project.name}</span>}
                    {parent && (
                        <button className="hover:text-fg" onClick={() => openIssue(parent.id)}>
                            {t('issue.parent', { id: parent.id })}
                        </button>
                    )}
                </div>
                {issue ? (
                    <IssueTitle issue={issue} />
                ) : (
                    <h2 className="mt-0.5 text-xl font-semibold leading-snug">{placeholderTitle}</h2>
                )}
                {issue && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusTag status={issue.status} />
                        <PriorityChip priority={issue.priority} />
                        <DueChip issue={issue} now={new Date()} />
                        <VersionChip issue={issue} />
                    </div>
                )}
                {issue && <IssueQuickActions issue={issue} />}
            </div>
            <RefreshButton spinning={refreshing} onClick={onRefresh} />
            <Button variant="primary" onClick={onOpenInRedmine}>
                <ExternalLink size={14} /> {t('common.openInRedmine')}
            </Button>
            <IconButton label={t('common.close')} icon={<X size={16} />} onClick={onClose} />
        </header>
    )
}

/** Next to the number: copy it, the link, "#1234 Title" or a Markdown link. */
function CopyMenu({ issue, url }: { issue: IssueDetail; url: string }) {
    const { t } = useI18n()
    const copy = useCopy()
    const entries = COPY_FORMATS.filter((format) => format !== 'title').map((format) => ({
        label: t(`issue.copy.${format}`),
        onSelect: () => void copy(copyText(format, issue, url))
    }))
    return <Menu label={t('issue.copy.menu')} icon={<Copy />} entries={entries} className="-my-1" />
}

function IssueTitle({ issue }: { issue: IssueDetail }) {
    const { t } = useI18n()
    const [editing, setEditing] = useState(false)
    if (editing) return <TitleEditor issue={issue} onClose={() => setEditing(false)} />
    return (
        <div className="mt-0.5 flex items-start gap-1">
            <h2 className="select-text text-xl font-semibold leading-snug">{issue.subject}</h2>
            <IconButton
                size="sm"
                className="mt-0.5 shrink-0 text-muted"
                label={t('issue.edit.titleAction')}
                icon={<Pencil />}
                onClick={() => setEditing(true)}
            />
            <CopyButton
                className="mt-0.5 shrink-0 text-muted"
                text={issue.subject}
                label={t('issue.copy.titleAction')}
            />
        </div>
    )
}

/** Enter saves, Esc cancels (without closing the issue). */
function TitleEditor({ issue, onClose }: { issue: IssueDetail; onClose: () => void }) {
    const { t } = useI18n()
    const { save, saving } = useSaveField(issue)
    const [draft, setDraft] = useState(issue.subject)
    const unchanged = draft.trim() === issue.subject || !draft.trim()
    const submit = () => {
        if (unchanged) return
        save({ subject: draft }, 'subject', draft.trim(), onClose)
    }
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') submit()
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
    }
    return (
        <div className="mt-1 flex items-center gap-2">
            <Input
                autoFocus
                className="h-10 text-lg font-semibold"
                maxLength={MAX_SUBJECT_LENGTH}
                value={draft}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
            />
            <Button onClick={onClose} disabled={saving}>
                {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={submit} disabled={saving || unchanged}>
                {t('common.save')}
            </Button>
        </div>
    )
}

function DescriptionSection({ issue, ...markdownLinks }: { issue: IssueDetail } & MarkdownLinkProps) {
    const { t } = useI18n()
    const [editing, setEditing] = useState(false)
    if (editing) return <DescriptionEditor issue={issue} onClose={() => setEditing(false)} />
    return (
        <section>
            <div className="mb-1.5 flex items-center justify-between">
                <Overline>{t('issue.description')}</Overline>
                <div className="flex items-center gap-1">
                    {issue.description?.trim() && (
                        <CopyButton
                            className="text-muted"
                            text={issue.description}
                            label={t('issue.copy.descriptionAction')}
                        />
                    )}
                    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
                        <Pencil size={13} /> {t('common.edit')}
                    </Button>
                </div>
            </div>
            <Description issue={issue} {...markdownLinks} />
        </section>
    )
}

function Description({ issue, ...markdownLinks }: { issue: IssueDetail } & MarkdownLinkProps) {
    const { t } = useI18n()
    if (!issue.description?.trim()) {
        return <p className="text-sm italic text-muted">{t('issue.noDescription')}</p>
    }
    return (
        <ClampedContent lines={DESCRIPTION_VISIBLE_LINES}>
            <Markdown text={issue.description} {...markdownLinks} />
        </ClampedContent>
    )
}

/**
 * The description's Markdown, as Redmine stores it. Esc does not close the issue (the text would be lost);
 * ⌘/Ctrl + Enter saves.
 */
function DescriptionEditor({ issue, onClose }: { issue: IssueDetail; onClose: () => void }) {
    const { t } = useI18n()
    const { save, saving } = useSaveField(issue)
    const original = issue.description ?? ''
    const [draft, setDraft] = useState(original)
    const unchanged = draft === original
    const submit = () => {
        if (unchanged) return
        save({ description: draft }, 'description', t('issue.edit.updated'), onClose)
    }
    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Escape') event.stopPropagation()
        const withModifier = event.metaKey || event.ctrlKey
        if (event.key === 'Enter' && withModifier) submit()
    }
    return (
        <section>
            <Overline className="mb-1.5">{t('issue.description')}</Overline>
            <MarkdownEditor
                autoFocus
                className="min-h-96"
                value={draft}
                attachments={issue.attachments}
                disabled={saving}
                onChange={setDraft}
                onKeyDown={handleKeyDown}
            />
            <div className="mt-2 flex items-center justify-end gap-2">
                <span className="mr-auto text-xs text-muted">
                    {t('issue.edit.descriptionHint', { shortcut: SUBMIT_SHORTCUT })}
                </span>
                <Button onClick={onClose} disabled={saving}>
                    {t('common.cancel')}
                </Button>
                <Button variant="primary" onClick={submit} disabled={saving || unchanged}>
                    {t('common.save')}
                </Button>
            </div>
        </section>
    )
}

/** Comment with Markdown preview and attachments (picked, dropped or pasted into the text). */
function CommentBox({
    issue,
    comment,
    saving
}: {
    issue: IssueDetail
    comment: ReturnType<typeof useCommentAndChange>
    saving: boolean
}) {
    // A new key after sending starts an empty form (text and chosen files).
    const [formKey, setFormKey] = useState(0)
    return (
        <CommentForm
            key={formKey}
            issue={issue}
            comment={comment}
            saving={saving}
            onSent={() => setFormKey((key) => key + 1)}
        />
    )
}

function CommentForm({
    issue,
    comment,
    saving,
    onSent
}: {
    issue: IssueDetail
    comment: ReturnType<typeof useCommentAndChange>
    saving: boolean
    onSent: () => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const [draft, setDraft] = useState('')
    const files = useChosenFiles()

    const submit = () => {
        comment.mutate(
            { id: issue.id, change: { notes: draft }, uploads: files.uploads },
            {
                onSuccess: () => {
                    toast(t('issue.commentAdded'))
                    onSent()
                },
                onError: (mutationError) => toast(error(mutationError), 'error')
            }
        )
    }

    return (
        <div className="mt-5 flex flex-col gap-2">
            <CommentWithFiles
                comment={draft}
                onComment={setDraft}
                files={files}
                attachments={issue.attachments}
                placeholder={t('issue.commentPlaceholder')}
            />
            <div className="flex justify-end">
                <Button variant="primary" disabled={!draft.trim() || saving} onClick={submit}>
                    {t('issue.comment')}
                </Button>
            </div>
        </div>
    )
}

function hasCustomFieldValue(field: CustomFieldValue): boolean {
    const { value } = field
    if (value === null || value === '') return false
    if (Array.isArray(value)) return value.length > 0
    return true
}

// Redmine sends boolean custom fields as '1' / '0'.
function formatCustomFieldValue(value: CustomFieldValue['value'], t: Translate) {
    if (Array.isArray(value)) return value.join(', ')
    if (value === '1') return t('common.yes')
    if (value === '0') return t('common.no')
    return value
}

function PersonValue({ name }: { name?: string }) {
    if (!name) return <span className="text-muted">—</span>
    return (
        <span className="flex items-center gap-1.5">
            <Avatar name={name} /> {name}
        </span>
    )
}

function IssueSidebar({
    issue,
    saving,
    onStatus
}: {
    issue: IssueDetail
    saving: boolean
    onStatus: (id: number) => void
}) {
    const { t, dates } = useI18n()
    const customFields = (issue.custom_fields ?? []).filter(hasCustomFieldValue)
    // Without the current status among the options, the select would silently display the first allowed one.
    const includesCurrentStatus = issue.allowed_statuses.some((status) => status.id === issue.status.id)
    const statusOptions = includesCurrentStatus ? issue.allowed_statuses : [issue.status, ...issue.allowed_statuses]
    const now = new Date()

    return (
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel-2/40 px-4 py-4 text-sm">
            <Property label={t('issue.status')}>
                <Select
                    value={issue.status.id}
                    disabled={saving}
                    onChange={(event) => onStatus(Number(event.target.value))}
                >
                    {statusOptions.map((status) => (
                        <option key={status.id} value={status.id}>
                            {status.name}
                        </option>
                    ))}
                </Select>
            </Property>
            <IssueFieldEditors issue={issue} busy={saving} />
            <Property label={t('issue.spent')}>{dates.hours(issue.spent_hours)}</Property>
            <Property label={t('issue.author')}>
                <PersonValue name={issue.author.name} />
            </Property>
            {customFields.map((field) => (
                <Property key={field.id} label={field.name}>
                    {formatCustomFieldValue(field.value, t)}
                </Property>
            ))}
            {issue.watchers.length > 0 && (
                <Property label={t('issue.watchers', { count: issue.watchers.length })}>
                    <div className="flex flex-wrap gap-1">
                        {issue.watchers.map((watcher) => (
                            <Avatar key={watcher.id} name={watcher.name} />
                        ))}
                    </div>
                </Property>
            )}
            <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
                {t('issue.created', { date: dates.dateTime(issue.created_on) })}
                <br />
                {t('issue.updated', { when: dates.relativeTime(issue.updated_on, now) })}
            </div>
        </aside>
    )
}

function fieldLabel(name: string, t: Translate) {
    return t(`fields.${name}` as 'fields.subject', { defaultValue: name })
}

// Long or id-valued fields only say "changed" instead of showing raw before/after values.
function isOpaqueField(name: string) {
    return name === 'description' || name === 'subject' || name.endsWith('_id')
}

function describeJournalDetail(detail: JournalDetail, t: Translate, statusName: Map<number, string>): string {
    if (detail.property === 'attachment') {
        if (detail.new_value) return t('issue.journal.attachmentAdded', { name: detail.new_value })
        return t('issue.journal.attachmentRemoved', { name: detail.old_value ?? '' })
    }
    if (detail.property === 'relation') {
        const relatedId = detail.new_value ?? detail.old_value ?? ''
        return t('issue.journal.relation', { name: detail.name, id: relatedId })
    }
    if (detail.property === 'cf') return t('issue.journal.customField')
    if (detail.name === 'status_id') {
        const nameOf = (value?: string | null) => statusName.get(Number(value)) ?? value ?? '—'
        return t('issue.journal.status', { from: nameOf(detail.old_value), to: nameOf(detail.new_value) })
    }
    const field = fieldLabel(detail.name, t)
    if (isOpaqueField(detail.name)) return t('issue.journal.changed', { field })
    return t('issue.journal.value', { field, from: detail.old_value || '—', to: detail.new_value || '—' })
}

function hasJournalContent(journal: Journal) {
    return Boolean(journal.notes?.trim()) || journal.details.length > 0
}

function History({
    issue,
    statusName,
    composer,
    ...markdownLinks
}: { issue: IssueDetail; statusName: Map<number, string>; composer: ReactNode } & MarkdownLinkProps) {
    const { t } = useI18n()
    const [order, setOrder] = useState<JournalOrder>(loadJournalOrder)
    const withContent = issue.journals.filter(hasJournalContent)
    const newestFirst = order === 'newest'
    const journals = newestFirst ? [...withContent].reverse() : withContent
    const toggleOrder = () => {
        const next = newestFirst ? 'oldest' : 'newest'
        setOrder(next)
        saveJournalOrder(next)
    }
    return (
        <section className="mt-7">
            <div className="mb-2 flex items-center justify-between">
                <Overline>{t('issue.history', { count: journals.length })}</Overline>
                <Button variant="ghost" className="h-7 px-2 text-xs" onClick={toggleOrder}>
                    <ArrowDownUp size={13} /> {t(`issue.historyOrder.${order}`)}
                </Button>
            </div>
            {/* The comment box stays next to the newest notes. */}
            {newestFirst && <div className="mb-5">{composer}</div>}
            <ol className="flex flex-col gap-4">
                {journals.map((journal) => (
                    <JournalItem
                        key={journal.id}
                        issue={issue}
                        journal={journal}
                        statusName={statusName}
                        {...markdownLinks}
                    />
                ))}
            </ol>
            {!newestFirst && composer}
        </section>
    )
}

function JournalItem({
    issue,
    journal,
    statusName,
    ...markdownLinks
}: { issue: IssueDetail; journal: Journal; statusName: Map<number, string> } & MarkdownLinkProps) {
    const { t, dates } = useI18n()
    return (
        <li className="flex gap-3">
            <Avatar name={journal.user.name} className="mt-0.5 h-6 w-6 text-2xs" />
            <div className="min-w-0 flex-1">
                <div className="text-xs">
                    <span className="font-medium">{journal.user.name}</span>{' '}
                    <span className="text-muted">· {dates.dateTime(journal.created_on)}</span>
                    <SendNoteButton issue={issue} journal={journal} />
                    {journal.private_notes && (
                        <span className="ml-1 rounded bg-panel-2 px-1 text-2xs text-muted">{t('common.private')}</span>
                    )}
                </div>
                {journal.details.length > 0 && (
                    <ul className="mt-0.5 text-xs text-muted">
                        {journal.details.map((detail, index) => (
                            <li key={index}>• {describeJournalDetail(detail, t, statusName)}</li>
                        ))}
                    </ul>
                )}
                {journal.notes?.trim() && (
                    <div className="mt-1.5 rounded-lg border border-line bg-panel px-3 py-2">
                        <Markdown text={journal.notes} {...markdownLinks} />
                    </div>
                )}
            </div>
        </li>
    )
}
