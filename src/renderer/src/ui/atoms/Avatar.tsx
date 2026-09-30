import { cn } from '@/lib/cn'

function initialsOf(name: string) {
    const words = name.trim().split(/\s+/)
    const firstInitial = words[0][0]
    const lastInitial = words.length > 1 ? words[words.length - 1][0] : ''
    return (firstInitial + lastInitial).toUpperCase()
}

// Stable hue (0–359) derived from the name, so the same person always gets the same color.
function hueOf(name: string) {
    let hash = 0
    for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) % 360
    return hash
}

export function Avatar({ name, className }: { name?: string; className?: string }) {
    if (!name) return null
    const initials = initialsOf(name)
    const hue = hueOf(name)
    return (
        <span
            title={name}
            className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-white',
                className
            )}
            style={{ background: `hsl(${hue} 45% 45%)` }}
        >
            {initials}
        </span>
    )
}
