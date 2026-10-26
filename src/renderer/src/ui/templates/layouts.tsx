import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { LoadingBar } from '../atoms/LoadingBar'

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
    return (
        <div className="flex h-full">
            {sidebar}
            <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
    )
}

// Caps, not fixed widths: the content grows with the window up to a readable limit. Screens rearrange into columns
// with container queries on `page` (the area left by the sidebar and the tabs), not on the window width.
const CONTENT_WIDTHS = { md: 'max-w-[80rem] gap-4', lg: 'max-w-[100rem]', xl: 'max-w-[140rem]' }

// The header doubles as the macOS title bar, so it is draggable. Without `width`, the body fills the whole page.
export function PageLayout({
    title,
    subtitle,
    actions,
    width,
    loading = false,
    children
}: {
    title: ReactNode
    subtitle?: ReactNode
    actions?: ReactNode
    width?: 'md' | 'lg' | 'xl'
    /** Data of the screen being fetched: a moving line under the header. */
    loading?: boolean
    children: ReactNode
}) {
    return (
        <div className="flex h-full flex-col">
            <header className="drag relative flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
                <h1 className="text-lg font-semibold">{title}</h1>
                {subtitle}
                {actions && <div className="no-drag ml-auto flex items-center gap-2">{actions}</div>}
                <LoadingBar active={loading} className="absolute inset-x-0 -bottom-px" />
            </header>
            {width ? <ScrollableContent width={width}>{children}</ScrollableContent> : children}
        </div>
    )
}

function ScrollableContent({ width, children }: { width: keyof typeof CONTENT_WIDTHS; children: ReactNode }) {
    return (
        <div className="@container/page flex-1 overflow-y-auto">
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
