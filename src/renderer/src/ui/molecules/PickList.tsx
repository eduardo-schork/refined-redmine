import { useEffect, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { foldForSearch } from '@domain/shared/text'
import { cn } from '@/lib/cn'
import { FLOATING_PANEL, useFloating } from '@/lib/floating'
import { useI18n } from '@/lib/i18n'

export interface PickOption {
    value: string
    label: string
    /** Options with a group are listed under its name, in the order the groups first appear. */
    group?: string
}

/**
 * A choice that is only made by clicking an option. Unlike a native select, typing or using the arrow keys
 * never changes the value: typing filters the list. Used where each change is saved to Redmine at once.
 */
export function PickList({
    value,
    options,
    disabled = false,
    placeholder,
    searchPlaceholder,
    noMatches,
    className,
    onPick
}: {
    value: string
    options: PickOption[]
    disabled?: boolean
    /** Shown while no option has `value`. */
    placeholder?: string
    searchPlaceholder?: string
    noMatches?: string
    className?: string
    onPick: (option: PickOption) => void
}) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const [filter, setFilter] = useState('')
    const { rootRef, floatingRef, anchorStyle, floatingStyle } = useFloating(open, () => setOpen(false))
    const current = options.find((option) => option.value === value)

    // While a change is being saved the field is disabled: an open list would allow a second change.
    useEffect(() => {
        if (disabled) setOpen(false)
    }, [disabled])

    const toggle = () => {
        setFilter('')
        setOpen((wasOpen) => !wasOpen)
    }
    const pick = (option: PickOption) => {
        setOpen(false)
        if (option.value !== value) onPick(option)
    }
    // Esc closes only the list, not the dialog around it.
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key !== 'Escape') return
        keyboardEvent.stopPropagation()
        setOpen(false)
    }

    const term = foldForSearch(filter.trim())
    const visible = options.filter((option) => !term || foldForSearch(option.label).includes(term))

    return (
        <div ref={rootRef} className={cn('min-w-0', className)} onKeyDown={handleKeyDown}>
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={toggle}
                style={anchorStyle}
                className="flex h-9 w-full cursor-default items-center gap-2 rounded-md border border-line bg-panel px-2.5 text-left text-sm outline-none focus:border-accent disabled:opacity-50"
            >
                <span className={cn('min-w-0 flex-1 truncate', !current && 'text-muted')}>
                    {current?.label ?? placeholder ?? ''}
                </span>
                <ChevronDown size={15} className="shrink-0 text-muted" />
            </button>
            {open && (
                <div
                    ref={floatingRef}
                    popover="manual"
                    style={floatingStyle}
                    className={cn(FLOATING_PANEL, 'max-w-md')}
                >
                    <div className="flex items-center gap-2 border-b border-line px-2.5">
                        <Search size={14} className="shrink-0 text-muted" />
                        <input
                            autoFocus
                            value={filter}
                            placeholder={searchPlaceholder ?? t('common.searchList')}
                            onChange={(changeEvent) => setFilter(changeEvent.target.value)}
                            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                        />
                    </div>
                    <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
                        {visible.map((option, index) => {
                            const selected = option.value === value
                            const startsGroup = option.group && option.group !== visible[index - 1]?.group
                            return (
                                <li key={option.value} role="option" aria-selected={selected}>
                                    {startsGroup && (
                                        <div className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-muted">
                                            {option.group}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => pick(option)}
                                        className={cn(
                                            'flex w-full cursor-default items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-panel-2',
                                            selected && 'font-medium'
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                        {selected && <Check size={14} className="shrink-0 text-accent" />}
                                    </button>
                                </li>
                            )
                        })}
                        {!visible.length && (
                            <li className="px-2.5 py-2 text-xs text-muted">{noMatches ?? t('common.noMatches')}</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    )
}
