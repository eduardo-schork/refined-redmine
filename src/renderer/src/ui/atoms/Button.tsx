import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
}

const VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-on-accent hover:brightness-110',
    outline: 'border border-line bg-panel hover:bg-panel-2',
    ghost: 'text-muted hover:bg-panel-2 hover:text-fg',
    danger: 'border border-line text-danger hover:bg-accent-soft'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'outline', className, type = 'button', ...props },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            {...props}
            className={cn(
                'inline-flex h-8 cursor-default items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
                VARIANTS[variant],
                className
            )}
        />
    )
})
