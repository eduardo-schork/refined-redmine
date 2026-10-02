import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { CustomFieldValue, IssueDetail, Journal, JournalDetail } from '@domain/redmine/entities'
import { RedmineLinks } from '@domain/redmine/links'
import { useChangeIssueStatus, useCommentOnIssue, useIssue } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { useSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { rememberIssue } from '@/lib/recent-issues'
import { Avatar } from '../atoms/Avatar'
import { Button } from '../atoms/Button'
import { Select, Textarea } from '../atoms/fields'
import { IconButton } from '../atoms/IconButton'
import { Overline } from '../atoms/misc'
import { Dialog } from '../molecules/Dialog'
import { Markdown } from '../molecules/Markdown'
import { Alert, Property } from '../molecules/surfaces'
import { useToast } from '../molecules/Toast'
import { IssueFieldEditors } from './IssueFieldEditors'
import { DueChip, PriorityChip, VersionChip } from '../molecules/issue-chips'
import { IssueDetailTabs } from './IssueDetailTabs'
import { IssueQuickActions } from './IssueQuickActions'
import { StatusTag } from '../molecules/StatusTag'

type Translate = ReturnType<typeof useI18n>['t']

interface MarkdownLinkProps {
    links: RedmineLinks
    onIssue: (id: number) => void
    onExternal: (url: string) => void
}

// Any screen can open the modal with openIssue(id); opened issues form a stack so "← back" returns to the previous one.
const OpenIssueContext = createContext<(id: number) => void>(() => {})
export const useOpenIssue = () => useContext(OpenIssueContext)

export function IssueModalProvider({ children }: { children: ReactNode }) {
    const [stack, setStack] = useState<number[]>([])
    const current = stack[stack.length - 1]
    const pushIssue = (id: number) => setStack((previous) => [...previous, id])
    const popIssue = () => setStack((previous) => previous.slice(0, -1))
    return (
        <OpenIssueContext.Provider value={pushIssue}>
            {children}
            {current !== undefined && (
                <IssueModal key={current} id={current} canGoBack={stack.length > 1} onClose={popIssue} />
            )}
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
    const settings = useSettings()
    const links = new RedmineLinks(settings.baseUrl)
    const issueQuery = useIssue(id)
    const statuses = useStatuses()
    const changeStatus = useChangeIssueStatus(id)
    const comment = useCommentOnIssue(id)
    const issue = issueQuery.data
    useEffect(() => {
        if (issue) rememberIssue({ id: issue.id, subject: issue.subject, project: issue.project.name })
    }, [issue])
    const statusName = new Map((statuses.data ?? []).map((status) => [status.id, status.name]))
    const saving = changeStatus.isPending || comment.isPending
    const markdownLinks: MarkdownLinkProps = { links, onIssue: openIssue, onExternal: openExternal }

    const handleStatusChange = (statusId: number) => {
        changeStatus.mutate(statusId, {
            onSuccess: () => toast(t('issue.statusChanged', { status: statusName.get(statusId) ?? statusId })),
            onError: (mutationError) => toast(error(mutationError), 'error')
        })
    }

    return (
        <Dialog onClose={onClose} size="xl" bare title={issue?.subject}>
            <IssueHeader
                id={id}
                issue={issue}
                isError={issueQuery.isError}
                canGoBack={canGoBack}
                onClose={onClose}
                issueUrl={links.issue(id)}
                onOpenInRedmine={() => openExternal(links.issue(id))}
            />

            {issueQuery.isError && <Alert className="m-5">{error(issueQuery.error)}</Alert>}

            {issue && (
                <div className="flex min-h-0 flex-1">
                    <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
                        <Description issue={issue} {...markdownLinks} />
                        <IssueDetailTabs key={issue.id} issue={issue} links={links} onOpenIssue={openIssue} />
                        <History issue={issue} statusName={statusName} {...markdownLinks} />
                        <CommentBox comment={comment} saving={saving} />
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
    onOpenInRedmine
}: {
    id: number
    issue?: IssueDetail
    isError: boolean
    canGoBack: boolean
    onClose: () => void
    issueUrl: string
    onOpenInRedmine: () => void
}) {
    const { t } = useI18n()
    const openIssue = useOpenIssue()
    const parent = issue?.parent
    const placeholderTitle = isError ? t('issue.loadError') : t('common.loading')

    return (
        <header className="flex items-start gap-3 border-b border-line px-5 py-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                    {canGoBack && (
                        <button className="mr-1 hover:text-fg" onClick={onClose}>
                            ← {t('common.back')}
                        </button>
                    )}
                    <span>{issue?.tracker.name}</span>
                    <span className="font-medium">#{id}</span>
                    {issue && <span>· {issue.project.name}</span>}
                    {parent && (
                        <button className="hover:text-fg" onClick={() => openIssue(parent.id)}>
                            {t('issue.parent', { id: parent.id })}
                        </button>
                    )}
                </div>
                <h2 className="mt-0.5 select-text text-xl font-semibold leading-snug">
                    {issue?.subject ?? placeholderTitle}
                </h2>
                {issue && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusTag status={issue.status} />
                        <PriorityChip priority={issue.priority} />
                        <DueChip issue={issue} now={new Date()} />
                        <VersionChip issue={issue} />
                    </div>
                )}
                {issue && <IssueQuickActions issue={issue} url={issueUrl} />}
            </div>
            <Button variant="primary" onClick={onOpenInRedmine}>
                <ExternalLink size={14} /> {t('common.openInRedmine')}
            </Button>
            <IconButton label={t('common.close')} icon={<X size={16} />} onClick={onClose} />
        </header>
    )
}

function Description({ issue, links, onIssue, onExternal }: { issue: IssueDetail } & MarkdownLinkProps) {
    const { t } = useI18n()
    if (!issue.description?.trim()) {
        return <p className="text-sm italic text-muted">{t('issue.noDescription')}</p>
    }
    return <Markdown text={issue.description} links={links} onIssue={onIssue} onExternal={onExternal} />
}

function CommentBox({ comment, saving }: { comment: ReturnType<typeof useCommentOnIssue>; saving: boolean }) {
    const { t, error } = useI18n()
    const toast = useToast()
    const [draft, setDraft] = useState('')

    const submit = () => {
        comment.mutate(draft, {
            onSuccess: () => {
                setDraft('')
                toast(t('issue.commentAdded'))
            },
            onError: (mutationError) => toast(error(mutationError), 'error')
        })
    }

    return (
        <div className="mt-5 rounded-lg border border-line">
            <Textarea
                className="rounded-b-none border-0 bg-transparent"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('issue.commentPlaceholder')}
            />
            <div className="flex justify-end border-t border-line px-2 py-1.5">
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
            <Property label={t('issue.author')}>
                <PersonValue name={issue.author.name} />
            </Property>
            <Property label={t('issue.estimated')}>{dates.hours(issue.estimated_hours)}</Property>
            <Property label={t('issue.spent')}>{dates.hours(issue.spent_hours)}</Property>
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

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-7">
            <Overline className="mb-2">{title}</Overline>
            {children}
        </section>
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
    ...markdownLinks
}: { issue: IssueDetail; statusName: Map<number, string> } & MarkdownLinkProps) {
    const { t } = useI18n()
    const journals = issue.journals.filter(hasJournalContent)
    return (
        <Block title={t('issue.history', { count: journals.length })}>
            <ol className="flex flex-col gap-4">
                {journals.map((journal) => (
                    <JournalItem key={journal.id} journal={journal} statusName={statusName} {...markdownLinks} />
                ))}
            </ol>
        </Block>
    )
}

function JournalItem({
    journal,
    statusName,
    links,
    onIssue,
    onExternal
}: { journal: Journal; statusName: Map<number, string> } & MarkdownLinkProps) {
    const { t, dates } = useI18n()
    return (
        <li className="flex gap-3">
            <Avatar name={journal.user.name} className="mt-0.5 h-6 w-6 text-2xs" />
            <div className="min-w-0 flex-1">
                <div className="text-xs">
                    <span className="font-medium">{journal.user.name}</span>{' '}
                    <span className="text-muted">· {dates.dateTime(journal.created_on)}</span>
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
                        <Markdown text={journal.notes} links={links} onIssue={onIssue} onExternal={onExternal} />
                    </div>
                )}
            </div>
        </li>
    )
}
