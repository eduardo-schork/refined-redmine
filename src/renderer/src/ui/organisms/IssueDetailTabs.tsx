import { useId, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { IssueDetail } from '@domain/redmine/entities'
import { linkedIssueIds } from '@domain/redmine/linked-issues'
import type { RedmineLinks } from '@domain/redmine/links'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { Tabs, tabPanelProps, type TabOption } from '../molecules/Tabs'
import { IssueAttachments } from './attachments/IssueAttachments'
import { IssueLinks } from './IssueLinks'
import { IssueTimeSection } from './time/IssueTimeSection'

type DetailTab = 'links' | 'attachments' | 'time'

/** Related issues, attachments and hours of the issue, one at a time; related issues first. */
export function IssueDetailTabs({
    issue,
    links,
    onOpenIssue,
    onNewSubtask
}: {
    issue: IssueDetail
    links: RedmineLinks
    onOpenIssue: (id: number) => void
    onNewSubtask: () => void
}) {
    const { t, dates } = useI18n()
    const tabsId = useId()
    const [tab, setTab] = useState<DetailTab>('links')
    const linkedCount = linkedIssueIds(issue).length
    const spentHours = issue.spent_hours ?? 0
    const options: TabOption<DetailTab>[] = [
        { value: 'links', label: t('issue.tabs.links'), badge: linkedCount || undefined },
        { value: 'attachments', label: t('issue.tabs.attachments'), badge: issue.attachments.length || undefined },
        { value: 'time', label: t('issue.tabs.time'), badge: spentHours ? dates.hours(spentHours) : undefined }
    ]
    const panels: Record<DetailTab, () => ReactNode> = {
        links: () => (
            <>
                <div className="-mt-1 mb-1 flex justify-end">
                    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={onNewSubtask}>
                        <Plus size={13} /> {t('issue.newSubtask')}
                    </Button>
                </div>
                {linkedCount ? (
                    <IssueLinks issue={issue} onOpen={onOpenIssue} />
                ) : (
                    <Empty>{t('issue.tabs.noLinks')}</Empty>
                )}
            </>
        ),
        attachments: () =>
            issue.attachments.length ? (
                <IssueAttachments attachments={issue.attachments} links={links} />
            ) : (
                <Empty>{t('issue.tabs.noAttachments')}</Empty>
            ),
        time: () => <IssueTimeSection issue={issue} />
    }

    return (
        <section className="mt-7">
            <Tabs id={tabsId} value={tab} options={options} onChange={setTab} />
            <div {...tabPanelProps(tabsId, tab)} className="pt-4">
                {panels[tab]()}
            </div>
        </section>
    )
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="py-2 text-sm text-muted">{children}</p>
}
