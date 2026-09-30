import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
    return (
        <div className="flex h-full">
            {sidebar}
            <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
    )
}

const CONTENT_WIDTHS = { md: 'max-w-3xl gap-4', lg: 'max-w-3xl', xl: 'max-w-6xl' }

// The header doubles as the macOS title bar, so it is draggable. Without `width`, the body fills the whole page.
export function PageLayout({
    title,
    subtitle,
    actions,
    width,
    children
}: {
    title: ReactNode
    subtitle?: ReactNode
    actions?: ReactNode
    width?: 'md' | 'lg' | 'xl'
    children: ReactNode
}) {
    return (
        <div className="flex h-full flex-col">
            <header className="drag flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
                <h1 className="text-lg font-semibold">{title}</h1>
                {subtitle}
                {actions && <div className="no-drag ml-auto flex items-center gap-2">{actions}</div>}
            </header>
            {width ? <ScrollableContent width={width}>{children}</ScrollableContent> : children}
        </div>
    )
}

function ScrollableContent({ width, children }: { width: keyof typeof CONTENT_WIDTHS; children: ReactNode }) {
    return (
        <div className="flex-1 overflow-y-auto">
            <div className={cn('mx-auto flex flex-col gap-6 px-5 py-5', CONTENT_WIDTHS[width])}>{children}</div>
        </div>
    )
}

export function CenteredLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-full flex-col">
            <div className="drag h-12 shrink-0" />
            <div className="flex flex-1 items-start justify-center overflow-y-auto p-8 pt-[12vh]">{children}</div>
        </div>
    )
}
