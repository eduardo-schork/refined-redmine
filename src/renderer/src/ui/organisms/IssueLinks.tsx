import { useMemo, type ReactNode } from 'react'
import type { Issue, IssueDetail } from '@domain/redmine/entities'
import { closedSubtaskCount, linkedIssueIds, relationGroups, siblingIds } from '@domain/redmine/linked-issues'
import { useIssue, useLinkedIssues } from '@/hooks/issues'
import { useI18n } from '@/lib/i18n'
import { Overline, ProgressBar } from '../atoms/misc'
import { LinkedIssueGroupLabel, LinkedIssueList, LinkedIssueRow } from '../molecules/LinkedIssueList'

const NOTHING_LOADED: ReadonlyMap<number, Issue> = new Map()

/**
 * Parent (with its other subtasks), subtasks and related issues of the issue, each with its title, status, version
 * and assignee. The parent is read first to know the siblings, so all of them come in one listing.
 */
export function IssueLinks({ issue, onOpen }: { issue: IssueDetail; onOpen: (id: number) => void }) {
    const parentQuery = useIssue(issue.parent?.id ?? 0, Boolean(issue.parent))
    const parent = parentQuery.data
    const siblings = useMemo(() => siblingIds(issue, parent), [issue, parent])
    const ids = useMemo(() => [...linkedIssueIds(issue), ...siblings], [issue, siblings])
    const parentSettled = !issue.parent || !parentQuery.isPending
    const linked = useLinkedIssues(issue.id, ids, parentSettled)
    const loaded = linked.data ?? NOTHING_LOADED
    return (
        <>
            <Parent issue={issue} parent={parent} siblings={siblings} loaded={loaded} onOpen={onOpen} />
            <Subtasks issue={issue} loaded={loaded} isLoaded={linked.isSuccess} onOpen={onOpen} />
            <Relations issue={issue} loaded={loaded} onOpen={onOpen} />
        </>
    )
}

function Parent({
    issue,
    parent,
    siblings,
    loaded,
    onOpen
}: {
    issue: IssueDetail
    parent?: IssueDetail
    siblings: number[]
    loaded: ReadonlyMap<number, Issue>
    onOpen: (id: number) => void
}) {
    const { t } = useI18n()
    if (!issue.parent) return null
    const parentId = issue.parent.id
    const siblingSubject = (id: number) => parent?.children.find((child) => child.id === id)?.subject
    return (
        <Section title={t('issue.parentField')}>
            <LinkedIssueList>
                <LinkedIssueRow
                    id={parentId}
                    issue={loaded.get(parentId)}
                    knownSubject={parent?.subject}
                    onOpen={onOpen}
                />
                {siblings.length > 0 && (
                    <LinkedIssueGroupLabel>{t('issue.siblings', { id: parentId })}</LinkedIssueGroupLabel>
                )}
                {siblings.map((id) => (
                    <LinkedIssueRow
                        key={id}
                        id={id}
                        issue={loaded.get(id)}
                        knownSubject={siblingSubject(id)}
                        onOpen={onOpen}
                    />
                ))}
            </LinkedIssueList>
        </Section>
    )
}

function Subtasks({
    issue,
    loaded,
    isLoaded,
    onOpen
}: {
    issue: IssueDetail
    loaded: ReadonlyMap<number, Issue>
    isLoaded: boolean
    onOpen: (id: number) => void
}) {
    const { t } = useI18n()
    const total = issue.children.length
    if (total === 0) return null
    const closed = closedSubtaskCount(issue, loaded)
    const progress = isLoaded && (
        <span className="flex items-center gap-2 text-xs text-muted">
            <ProgressBar value={(closed / total) * 100} className="w-20" />
            {t('issue.subtasksClosed', { closed, total })}
        </span>
    )
    return (
        <Section title={t('issue.subtasks', { count: total })} aside={progress}>
            <LinkedIssueList>
                {issue.children.map((child) => (
                    <LinkedIssueRow
                        key={child.id}
                        id={child.id}
                        issue={loaded.get(child.id)}
                        knownSubject={child.subject}
                        onOpen={onOpen}
                    />
                ))}
            </LinkedIssueList>
        </Section>
    )
}

function Relations({
    issue,
    loaded,
    onOpen
}: {
    issue: IssueDetail
    loaded: ReadonlyMap<number, Issue>
    onOpen: (id: number) => void
}) {
    const { t } = useI18n()
    const groups = relationGroups(issue.id, issue.relations)
    if (groups.length === 0) return null
    return (
        <Section title={t('issue.relations')}>
            <LinkedIssueList>
                {groups.map((group) => (
                    <RelationGroupRows
                        key={group.type}
                        label={t(`issue.relation.${group.type}`, { defaultValue: group.type })}
                    >
                        {group.issueIds.map((id) => (
                            <LinkedIssueRow key={id} id={id} issue={loaded.get(id)} onOpen={onOpen} />
                        ))}
                    </RelationGroupRows>
                ))}
            </LinkedIssueList>
        </Section>
    )
}

function RelationGroupRows({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <LinkedIssueGroupLabel>{label}</LinkedIssueGroupLabel>
            {children}
        </>
    )
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
    return (
        <section className="mt-6 first:mt-0">
            <div className="mb-2 flex items-center gap-3">
                <Overline>{title}</Overline>
                {aside}
            </div>
            {children}
        </section>
    )
}
