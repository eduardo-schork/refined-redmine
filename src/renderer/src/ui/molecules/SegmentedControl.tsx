import { cn } from '@/lib/cn'

export function SegmentedControl<T extends string>({
    value,
    options,
    onChange
}: {
    value: T
    options: { value: T; label: string; title?: string }[]
    onChange: (value: T) => void
}) {
    return (
        <div className="flex rounded-md border border-line p-0.5" role="tablist">
            {options.map((option) => (
                <button
                    key={option.value}
                    role="tab"
                    aria-selected={value === option.value}
                    title={option.title}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'h-7 cursor-default rounded px-2.5 text-[12px]',
                        value === option.value ? 'bg-panel-2 font-medium' : 'text-muted hover:text-fg'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
