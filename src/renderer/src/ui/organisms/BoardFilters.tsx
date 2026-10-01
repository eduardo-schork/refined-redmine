import { X } from 'lucide-react'
import type { ListGroupBy } from '@domain/board/issue-list'
import {
    EMPTY_QUICK_FILTER,
    filterOptions,
    isFilterActive,
    type QuickFilter,
    type QuickFilterField
} from '@domain/board/quick-filter'
import type { Issue } from '@domain/redmine/entities'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { Select } from '../atoms/fields'
import { FilterChip } from '../molecules/FilterChip'
import { SearchInput } from '../molecules/SearchInput'

const FIELDS: { field: QuickFilterField; labelKey: string; noneKey: string }[] = [
    { field: 'assignees', labelKey: 'board.filters.assignee', noneKey: 'board.noAssignee' },
    { field: 'trackers', labelKey: 'board.filters.tracker', noneKey: 'board.filters.none' },
    { field: 'statuses', labelKey: 'board.filters.status', noneKey: 'board.filters.none' },
    { field: 'versions', labelKey: 'board.filters.version', noneKey: 'board.filters.noVersion' }
]

const GROUP_OPTIONS: ListGroupBy[] = ['version', 'status', 'assignee', 'tracker', 'none']

/**
 * Quick filters of a board (cards and list): text, assignee, type, status and version. The options come from the
 * board's own issues, with how many issues each one has.
 */
export function BoardFilters({
    issues,
    filter,
    onChange,
    groupBy,
    onGroupBy
}: {
    issues: Issue[]
    filter: QuickFilter
    onChange: (filter: QuickFilter) => void
    /** Only in the list view. */
    groupBy?: ListGroupBy
    onGroupBy?: (groupBy: ListGroupBy) => void
}) {
    const { t } = useI18n()
    const set = (patch: Partial<QuickFilter>) => onChange({ ...filter, ...patch })
    return (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <SearchInput
                className="w-60"
                value={filter.search}
                onChange={(search) => set({ search })}
                placeholder={t('board.searchPlaceholder')}
            />
            {FIELDS.map(({ field, labelKey, noneKey }) => (
                <FilterChip
                    key={field}
                    label={t(labelKey as 'board.filters.status')}
                    allLabel={t('board.filters.all')}
                    clearLabel={t('board.filters.clearField')}
                    options={filterOptions(issues, field, t(noneKey as 'board.filters.none'))}
                    selected={filter[field]}
                    onChange={(selected) => set({ [field]: selected })}
                />
            ))}
            {isFilterActive(filter) && (
                <Button variant="ghost" onClick={() => onChange(EMPTY_QUICK_FILTER)}>
                    <X size={14} /> {t('board.filters.clear')}
                </Button>
            )}
            {groupBy && onGroupBy && (
                <label className="ml-auto flex items-center gap-2 text-sm text-muted">
                    {t('board.list.groupBy')}
                    <Select
                        className="w-40"
                        value={groupBy}
                        onChange={(event) => onGroupBy(event.target.value as ListGroupBy)}
                    >
                        {GROUP_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {t(`board.list.group.${option}`)}
                            </option>
                        ))}
                    </Select>
                </label>
            )}
        </div>
    )
}
