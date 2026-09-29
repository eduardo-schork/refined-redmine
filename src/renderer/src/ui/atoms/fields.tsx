import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// Default width is 100%, unless the caller passes its own width (w-*).
const hasWidth = (className?: string) => /(^|\s)w-/.test(className ?? '')
const baseClasses =
    'rounded-md border border-line bg-panel text-[13px] outline-none focus:border-accent disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
    { className, ...props },
    ref
) {
    return (
        <input
            ref={ref}
            {...props}
            className={cn(
                baseClasses,
                'h-8 px-2.5 placeholder:text-muted',
                !hasWidth(className) && 'w-full',
                className
            )}
        />
    )
})

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select {...props} className={cn(baseClasses, 'h-8 px-2', !hasWidth(className) && 'w-full', className)}>
            {children}
        </select>
    )
}

/** Compact dashed select, used as an "add" control (+ status, + reminder). */
export function AddSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            {...props}
            value=""
            className={cn(
                'h-7 rounded-md border border-dashed border-line bg-transparent px-1.5 text-xs text-muted outline-none',
                className
            )}
        >
            {children}
        </select>
    )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            className={cn(baseClasses, 'min-h-24 w-full resize-y px-2.5 py-2 placeholder:text-muted', className)}
        />
    )
}
