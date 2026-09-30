import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type IconButtonSize = 'md' | 'sm'
export type IconButtonTone = 'default' | 'danger'

// The icon size is set here, whatever size the caller gave the icon, so every toolbar looks the same.
const SIZES: Record<IconButtonSize, string> = {
    md: 'h-9 w-9 border border-line bg-panel [&_svg]:size-[17px]',
    sm: 'h-7 w-7 [&_svg]:size-[15px]'
}

const TONES: Record<IconButtonTone, string> = {
    default: 'text-fg/85 hover:bg-panel-2 hover:text-fg',
    danger: 'text-fg/85 hover:border-danger/40 hover:bg-danger/10 hover:text-danger'
}

/** Icon-only button: the label becomes the tooltip and accessible text. */
export function IconButton({
    label,
    icon,
    className,
    size = 'md',
    tone = 'default',
    type = 'button',
    ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    label: string
    icon: ReactNode
    size?: IconButtonSize
    tone?: IconButtonTone
}) {
    return (
        <button
            type={type}
            title={label}
            aria-label={label}
            {...props}
            className={cn(
                'inline-flex shrink-0 cursor-default items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50',
                SIZES[size],
                TONES[tone],
                className
            )}
        >
            {icon}
        </button>
    )
}
