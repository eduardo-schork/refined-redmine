import { Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { SearchResultList } from '../../molecules/SearchResultList'
import { useQuickSearch } from './useQuickSearch'

/** ⌘K / Ctrl+K palette: issues by number or title, boards and screens. */
export function QuickSearch({ onClose }: { onClose: () => void }) {
    const { t } = useI18n()
    const search = useQuickSearch({ onDone: onClose, onEscape: onClose })

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-6 pt-[12vh]"
            onMouseDown={onClose}
        >
            <div
                role="dialog"
                aria-label={t('search.button')}
                className="flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
                onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
            >
                <div className="flex items-center gap-2 border-b border-line px-4">
                    <Search size={16} className="text-muted" />
                    <input
                        autoFocus
                        value={search.input}
                        placeholder={t('search.placeholder')}
                        onChange={(changeEvent) => search.setInput(changeEvent.target.value)}
                        onKeyDown={search.handleKeyDown}
                        className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                    />
                    {search.loading && <span className="text-xs text-muted">{t('search.searching')}</span>}
                </div>
                <div ref={search.listRef} className="min-h-0 overflow-y-auto py-1">
                    <SearchResultList
                        items={search.items}
                        activeIndex={search.activeIndex}
                        onHover={search.setActiveIndex}
                        message={search.message}
                    />
                </div>
                <div className="border-t border-line px-4 py-2 text-2xs text-muted">{t('search.keys')}</div>
            </div>
        </div>
    )
}
