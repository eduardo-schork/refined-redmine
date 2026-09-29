import { cn } from '@/lib/cn'

export function Switch({
    checked,
    onChange,
    label
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={cn(
                'flex h-[18px] w-8 shrink-0 cursor-default items-center rounded-full p-0.5 transition-colors',
                checked ? 'bg-accent' : 'bg-line'
            )}
        >
            <span
                className={cn(
                    'h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                    checked && 'translate-x-3.5'
                )}
            />
        </button>
    )
}
