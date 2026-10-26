import { RefreshCw } from 'lucide-react'
import { useSavedQueries } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { IconButton } from '../atoms/IconButton'
import { PickList } from '../molecules/PickList'

/** Saved queries visible to the user (public ones and their own), with a button to reload the list. */
export function SavedQuerySelect({
    queryId,
    onChange
}: {
    queryId?: number
    onChange: (queryId: number, projectId?: number, name?: string) => void
}) {
    const { t } = useI18n()
    const queries = useSavedQueries()
    const placeholder = queries.isLoading ? t('common.loading') : t('common.select')

    const select = (value: string) => {
        const selectedId = Number(value)
        const savedQuery = queries.data?.find((candidate) => candidate.id === selectedId)
        onChange(selectedId, savedQuery?.project_id ?? undefined, savedQuery?.name)
    }
    const options = (queries.data ?? []).map((savedQuery) => ({
        value: String(savedQuery.id),
        label: savedQuery.is_public ? savedQuery.name : `${savedQuery.name} (${t('common.private')})`
    }))

    return (
        <div className="flex items-center gap-2">
            <PickList
                className="flex-1"
                value={queryId ? String(queryId) : ''}
                options={options}
                placeholder={placeholder}
                onPick={(option) => select(option.value)}
            />
            <IconButton
                label={t('board.editor.refreshQueries')}
                icon={<RefreshCw size={14} className={cn(queries.isFetching && 'animate-spin')} />}
                onClick={() => void queries.refetch()}
            />
        </div>
    )
}
