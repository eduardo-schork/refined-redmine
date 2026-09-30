import { useCallback, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { SEARCH_SHORTCUT } from '@/lib/shortcuts'
import { Kbd } from '../../atoms/Kbd'
import { SearchResultList } from '../../molecules/SearchResultList'
import { useQuickSearch } from './useQuickSearch'

/** The quick search as a field on the home page; results open below it while it has the focus. */
export function HomeSearch() {
    const { t } = useI18n()
    const inputRef = useRef<HTMLInputElement>(null)
    const [focused, setFocused] = useState(false)
    const leave = useCallback(() => inputRef.current?.blur(), [])
    const search = useQuickSearch({ onDone: leave, onEscape: leave })

    const handleBlur = () => {
        setFocused(false)
        search.setInput('')
    }

    return (
        <div className="relative">
            <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-panel px-4 focus-within:border-accent">
                <Search size={16} className="shrink-0 text-muted" />
                <input
                    ref={inputRef}
                    value={search.input}
                    placeholder={t('search.placeholder')}
                    onFocus={() => setFocused(true)}
                    onBlur={handleBlur}
                    onChange={(changeEvent) => search.setInput(changeEvent.target.value)}
                    onKeyDown={search.handleKeyDown}
                    className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                />
                {search.loading && <span className="shrink-0 text-xs text-muted">{t('search.searching')}</span>}
                {!focused && <Kbd className="shrink-0">{SEARCH_SHORTCUT}</Kbd>}
            </div>
            {focused && (
                <div
                    ref={search.listRef}
                    className="absolute inset-x-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-panel py-1 shadow-2xl"
                >
                    <SearchResultList
                        items={search.items}
                        activeIndex={search.activeIndex}
                        onHover={search.setActiveIndex}
                        message={search.message}
                    />
                </div>
            )}
        </div>
    )
}
