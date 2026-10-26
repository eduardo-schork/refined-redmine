import { useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FLOATING_PANEL, useFloating } from '@/lib/floating'

export interface FilterChipOption {
    value: string
    label: string
    count: number
}

/** "Type: All" / "Type: Bug, Feature" with a checklist; none checked means all. */
export function FilterChip({
    label,
    allLabel,
    clearLabel,
    options,
    selected,
    onChange
}: {
    label: string
    allLabel: string
    clearLabel: string
    options: FilterChipOption[]
    selected: string[]
    onChange: (selected: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const { rootRef, floatingRef, anchorStyle, floatingStyle } = useFloating(open, () => setOpen(false))
    const active = selected.length > 0
    const chosenLabels = options.filter((option) => selected.includes(option.value)).map((option) => option.label)
    const summary = active ? chosenLabels.join(', ') || selected.join(', ') : allLabel

    const toggle = (value: string) => {
        const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
        onChange(next)
    }
    // Esc closes only the list.
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key !== 'Escape') return
        keyboardEvent.stopPropagation()
        setOpen(false)
    }

    return (
        <div ref={rootRef} onKeyDown={handleKeyDown}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                style={anchorStyle}
                onClick={() => setOpen((wasOpen) => !wasOpen)}
                className={cn(
                    'inline-flex h-9 max-w-64 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm',
                    active ? 'border-accent/50 bg-accent-soft' : 'border-line bg-panel hover:bg-panel-2'
                )}
            >
                <span className="text-muted">{label}:</span>
                <span className={cn('min-w-0 truncate', active && 'font-medium')}>{summary}</span>
                <ChevronDown size={14} className="shrink-0 text-muted" />
            </button>
            {open && (
                <div ref={floatingRef} popover="manual" style={floatingStyle} className={cn(FLOATING_PANEL, 'w-64')}>
                    <ul role="listbox" aria-multiselectable="true" className="max-h-72 overflow-y-auto py-1">
                        {options.map((option) => {
                            const checked = selected.includes(option.value)
                            return (
                                <li key={option.value} role="option" aria-selected={checked}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(option.value)}
                                        className="flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-panel-2"
                                    >
                                        <span
                                            className={cn(
                                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                                checked ? 'border-accent bg-accent text-on-accent' : 'border-line'
                                            )}
                                        >
                                            {checked && <Check size={12} strokeWidth={3} />}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                        <span className="shrink-0 text-xs tabular-nums text-muted">{option.count}</span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                    {active && (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="flex w-full cursor-default items-center gap-1.5 border-t border-line px-3 py-2 text-left text-xs text-muted hover:text-fg"
                        >
                            <X size={12} /> {clearLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
