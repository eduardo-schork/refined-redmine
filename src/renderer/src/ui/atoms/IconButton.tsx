import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'
import { cn } from '@/lib/cn'

/** Icon-only button: the label becomes the tooltip and accessible text. */
export function IconButton({
    label,
    icon,
    className,
    variant = 'ghost',
    ...props
}: Omit<ButtonProps, 'children'> & { label: string; icon: ReactNode }) {
    return (
        <Button variant={variant} title={label} aria-label={label} className={cn('w-8 px-0', className)} {...props}>
            {icon}
        </Button>
    )
}
