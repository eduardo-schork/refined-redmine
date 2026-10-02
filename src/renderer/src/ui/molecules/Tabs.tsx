import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabOption<T extends string> {
    value: T
    label: string
    /** Small text after the label, such as a count. */
    badge?: ReactNode
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }

/** Underlined tabs; the caller renders the panel with `tabPanelProps`. Arrows move between tabs. */
export function Tabs<T extends string>({
    id,
    value,
    options,
    onChange,
    className
}: {
    id: string
    value: T
    options: TabOption<T>[]
    onChange: (value: T) => void
    className?: string
}) {
    const listRef = useRef<HTMLDivElement>(null)

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
        const step = STEP[keyboardEvent.key]
        if (!step) return
        keyboardEvent.preventDefault()
        const currentIndex = options.findIndex((option) => option.value === value)
        const nextIndex = (currentIndex + step + options.length) % options.length
        onChange(options[nextIndex].value)
        listRef.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[nextIndex]?.focus()
    }

    return (
        <div
            ref={listRef}
            role="tablist"
            onKeyDown={handleKeyDown}
            className={cn('flex gap-5 border-b border-line', className)}
        >
            {options.map((option) => {
                const selected = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        id={`${id}-tab-${option.value}`}
                        aria-selected={selected}
                        aria-controls={`${id}-panel`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            '-mb-px flex cursor-default items-center gap-1.5 border-b-2 pb-2 text-sm',
                            selected
                                ? 'border-accent font-medium text-fg'
                                : 'border-transparent text-muted hover:text-fg'
                        )}
                    >
                        {option.label}
                        {option.badge !== undefined && (
                            <span className="rounded bg-panel-2 px-1.5 text-2xs tabular-nums text-muted">
                                {option.badge}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}

/** Props for the panel of the selected tab. */
export function tabPanelProps(id: string, value: string) {
    return { role: 'tabpanel', id: `${id}-panel`, 'aria-labelledby': `${id}-tab-${value}` } as const
}
