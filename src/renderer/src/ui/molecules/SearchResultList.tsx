import type { LucideIcon } from 'lucide-react'
import { CornerDownLeft } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

export type SearchSection = 'recent' | 'issues' | 'pages' | 'boards'

export interface SearchResult {
    key: string
    section: SearchSection
    icon: LucideIcon
    label: string
    detail?: string
    run: () => void
}

const SECTION_ORDER: SearchSection[] = ['recent', 'issues', 'boards', 'pages']

/** Results grouped by section, with one active row driven by the keyboard or the mouse. */
export function SearchResultList({
    items,
    activeIndex,
    onHover,
    message
}: {
    items: SearchResult[]
    activeIndex: number
    onHover: (index: number) => void
    message?: string
}) {
    const { t } = useI18n()
    return (
        <>
            {SECTION_ORDER.map((section) => {
                const sectionItems = items.filter((item) => item.section === section)
                if (!sectionItems.length) return null
                return (
                    <div key={section} className="py-1">
                        <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {t(`search.${section}`)}
                        </div>
                        {sectionItems.map((item) => {
                            const index = items.indexOf(item)
                            return (
                                <SearchResultRow
                                    key={item.key}
                                    item={item}
                                    active={index === activeIndex}
                                    onHover={() => onHover(index)}
                                />
                            )
                        })}
                    </div>
                )
            })}
            {message && <p className="px-4 py-6 text-center text-xs text-muted">{message}</p>}
        </>
    )
}

function SearchResultRow({ item, active, onHover }: { item: SearchResult; active: boolean; onHover: () => void }) {
    const Icon = item.icon
    return (
        <button
            type="button"
            data-active={active}
            onMouseMove={onHover}
            // Keeps the focus in the search field, so an inline search does not close before the click.
            onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
            onClick={item.run}
            className={cn(
                'flex w-full cursor-default items-center gap-3 px-4 py-2 text-left text-[13px]',
                active && 'bg-accent-soft'
            )}
        >
            <Icon size={14} className={cn('shrink-0 text-muted', active && 'text-accent')} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.detail && <span className="shrink-0 truncate text-xs text-muted">{item.detail}</span>}
            {active && <CornerDownLeft size={13} className="shrink-0 text-muted" />}
        </button>
    )
}
