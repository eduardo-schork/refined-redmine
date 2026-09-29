import { RefreshCw } from 'lucide-react'
import { useSavedQueries } from '@/hooks/reference'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Select } from '../atoms/fields'
import { IconButton } from '../atoms/IconButton'

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

    return (
        <div className="flex items-center gap-2">
            <Select className="flex-1" value={queryId || ''} onChange={(event) => select(event.target.value)}>
                <option value="">{placeholder}</option>
                {queries.data?.map((savedQuery) => (
                    <option key={savedQuery.id} value={savedQuery.id}>
                        {savedQuery.name}
                        {savedQuery.is_public ? '' : ` (${t('common.private')})`}
                    </option>
                ))}
            </Select>
            <IconButton
                label={t('board.editor.refreshQueries')}
                icon={<RefreshCw size={14} className={cn(queries.isFetching && 'animate-spin')} />}
                onClick={() => void queries.refetch()}
            />
        </div>
    )
}
