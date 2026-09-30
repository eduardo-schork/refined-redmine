import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Board } from '@domain/board/board'
import { compareVersions } from '@domain/sprint/sprint-classifier'
import type { Sprint } from '@domain/sprint/sprint'
import { useSprints } from '@/hooks/sprints'
import { useI18n } from '@/lib/i18n'
import { Overline } from '@/ui/atoms/misc'
import { RefreshButton } from '@/ui/molecules/RefreshButton'
import { Alert } from '@/ui/molecules/surfaces'
import { SprintCard } from '@/ui/organisms/SprintCard'
import { SprintIssuesDialog } from '@/ui/organisms/SprintIssuesDialog'
import { SprintSetupForm } from '@/ui/organisms/SprintSetupForm'
import { CenteredLayout, PageLayout } from '@/ui/templates/layouts'

export default function SprintsPage({ onCreateBoard }: { onCreateBoard: (initial: Partial<Board>) => void }) {
    const { t, dates, error } = useI18n()
    const sprints = useSprints()
    const [selected, setSelected] = useState<Sprint | null>(null)
    const [showHistory, setShowHistory] = useState(false)

    const needsSetup = !sprints.isLoading && !sprints.configured && !sprints.isError
    if (needsSetup) {
        return (
            <CenteredLayout>
                <div className="w-full max-w-lg rounded-xl border border-line bg-panel p-6">
                    <h2 className="mb-1 text-lg font-semibold">{t('sprints.setup.title')}</h2>
                    <p className="mb-5 text-sm text-muted">{t('sprints.setup.subtitle')}</p>
                    <SprintSetupForm />
                </div>
            </CenteredLayout>
        )
    }

    const released = sprints.all
        .filter((sprint) => sprint.phase === 'released' && sprint.kind === 'sprint')
        .sort((first, second) => compareVersions(second.version.name, first.version.name))
        .slice(0, 12)
    const groups = sprints.all.filter((sprint) => sprint.kind === 'other' && sprint.version.status !== 'closed')

    function createBoardFromSelected(sprint: Sprint) {
        setSelected(null)
        onCreateBoard({
            name: t('sprints.boardName', { name: sprint.version.name }),
            source: { type: 'sprint', versionId: sprint.version.id }
        })
    }

    return (
        <PageLayout
            title={t('nav.sprints')}
            subtitle={<span className="text-xs text-muted">{sprints.projectName}</span>}
            width="xl"
            actions={<RefreshButton spinning={sprints.isFetching} onClick={() => void sprints.refetch()} />}
        >
            {sprints.isError && <Alert>{error(sprints.error)}</Alert>}
            {sprints.isLoading && <div className="text-sm text-muted">{t('sprints.loadingVersions')}</div>}

            <section>
                <Overline className="mb-2">{t('sprints.active')}</Overline>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                    {sprints.active.map((sprint) => (
                        <SprintCard key={sprint.version.id} sprint={sprint} onOpen={() => setSelected(sprint)} />
                    ))}
                </div>
            </section>

            {groups.length > 0 && (
                <section>
                    <Overline className="mb-2">{t('sprints.groups')}</Overline>
                    <div className="flex flex-wrap gap-2">
                        {groups.map((group) => (
                            <button
                                key={group.version.id}
                                onClick={() => setSelected(group)}
                                className="cursor-default rounded-lg border border-line bg-panel px-3 py-2 text-left hover:border-muted/50"
                                title={group.version.description}
                            >
                                <div className="text-sm font-medium">{group.version.name}</div>
                                {group.version.description && (
                                    <div className="max-w-64 truncate text-xs text-muted">
                                        {group.version.description}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <button
                    className="mb-2 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted hover:text-fg"
                    onClick={() => setShowHistory(!showHistory)}
                >
                    {showHistory ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {t('sprints.recent')}
                </button>
                {showHistory && (
                    <div className="overflow-hidden rounded-xl border border-line bg-panel">
                        <table className="w-full text-sm">
                            <thead className="bg-panel-2 text-left text-xs text-muted">
                                <tr>
                                    <th className="px-4 py-2 font-medium">{t('sprints.version')}</th>
                                    <th className="px-4 py-2 font-medium">{t('sprint.devDeadline')}</th>
                                    <th className="px-4 py-2 font-medium">{t('sprint.release')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {released.map((sprint) => (
                                    <tr
                                        key={sprint.version.id}
                                        className="border-t border-line hover:bg-panel-2/50"
                                        onClick={() => setSelected(sprint)}
                                    >
                                        <td className="px-4 py-2 font-medium">{sprint.version.name}</td>
                                        <td className="px-4 py-2 tabular-nums">
                                            {dates.date(sprint.devDeadline, true)}
                                        </td>
                                        <td className="px-4 py-2 tabular-nums">{dates.date(sprint.release, true)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {selected && (
                <SprintIssuesDialog
                    sprint={selected}
                    onClose={() => setSelected(null)}
                    onCreateBoard={() => createBoardFromSelected(selected)}
                />
            )}
        </PageLayout>
    )
}
