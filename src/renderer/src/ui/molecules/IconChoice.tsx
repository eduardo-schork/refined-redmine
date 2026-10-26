import { cn } from '@/lib/cn'
import { ACTION_ICON_NAMES, ActionIcon } from '../atoms/ActionIcon'
import type { LucideIcon } from 'lucide-react'

/** Row of icons to pick one from; clicking the chosen one goes back to the default icon. */
export function IconChoice({
    value,
    fallback,
    onChange
}: {
    value?: string
    fallback: LucideIcon
    onChange: (icon: string | undefined) => void
}) {
    return (
        <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {ACTION_ICON_NAMES.map((name) => {
                const chosen = value === name
                return (
                    <button
                        key={name}
                        type="button"
                        aria-pressed={chosen}
                        aria-label={name}
                        title={name}
                        onClick={() => onChange(chosen ? undefined : name)}
                        className={cn(
                            'flex h-8 w-8 cursor-default items-center justify-center rounded-md border',
                            chosen ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg'
                        )}
                    >
                        <ActionIcon name={name} fallback={fallback} size={15} />
                    </button>
                )
            })}
        </div>
    )
}
