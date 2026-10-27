import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** `accent`: trâmites and what is active on this issue; `claude`: Claude Code actions; `plain`: the rest. */
export type ActionTone = 'plain' | 'accent' | 'claude'

const TONES: Record<ActionTone, string> = {
    plain: 'border-line text-fg/85 hover:bg-panel-2 hover:text-fg',
    accent: 'border-accent/40 bg-accent-soft text-accent hover:border-accent',
    claude: 'border-claude/40 bg-claude-soft text-claude hover:border-claude'
}

/** A button of the issue detail's action row (trâmites, Claude actions, log time…), with its icon first. */
export function ActionButton({
    tone = 'plain',
    className,
    type = 'button',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ActionTone }) {
    return (
        <button
            type={type}
            {...props}
            className={cn(
                'inline-flex h-8 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
                TONES[tone],
                className
            )}
        />
    )
}
