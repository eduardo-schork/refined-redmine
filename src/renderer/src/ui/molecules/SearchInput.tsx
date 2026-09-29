import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Input } from '../atoms/fields'

export function SearchInput({
    value,
    onChange,
    placeholder,
    className
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    className?: string
}) {
    return (
        <div className={cn('relative', className)}>
            <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            <Input
                className="w-full pl-7 pr-6"
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            {value && (
                <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                    onClick={() => onChange('')}
                >
                    <X size={13} />
                </button>
            )}
        </div>
    )
}
