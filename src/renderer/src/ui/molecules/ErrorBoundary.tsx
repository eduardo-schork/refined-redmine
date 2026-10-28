import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Copy, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { useCopy } from './CopyButton'

/** `tab`: one workspace tab stops, the rest keeps working. `app`: the whole window, with a reload. */
export type CrashScope = 'tab' | 'app'

interface CrashState {
    error?: Error
    componentStack?: string
}

const asError = (thrown: unknown) => (thrown instanceof Error ? thrown : new Error(String(thrown)))

/**
 * Shows the error of a crashed render instead of an empty window: without a boundary React unmounts the whole tree.
 * React itself already logs the error to the console.
 */
export class ErrorBoundary extends Component<{ scope: CrashScope; children: ReactNode }, CrashState> {
    state: CrashState = {}

    static getDerivedStateFromError(thrown: unknown): CrashState {
        return { error: asError(thrown) }
    }

    componentDidCatch(_thrown: unknown, info: ErrorInfo) {
        this.setState({ componentStack: info.componentStack ?? undefined })
    }

    private readonly retry = () => this.setState({ error: undefined, componentStack: undefined })

    render() {
        const { error, componentStack } = this.state
        if (!error) return this.props.children
        return (
            <CrashScreen scope={this.props.scope} error={error} componentStack={componentStack} onRetry={this.retry} />
        )
    }
}

function CrashScreen({
    scope,
    error,
    componentStack,
    onRetry
}: {
    scope: CrashScope
    error: Error
    componentStack?: string
    onRetry: () => void
}) {
    const { t } = useI18n()
    const copy = useCopy()
    const isApp = scope === 'app'
    const details = [error.stack ?? error.message, componentStack].filter(Boolean).join('\n')
    return (
        // The whole-window screen replaces the title bar too, so it is the draggable area.
        <div
            role="alert"
            className={cn(
                'flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center',
                isApp && 'drag h-full'
            )}
        >
            <AlertTriangle size={28} className="text-danger" />
            <div className="max-w-xl">
                <h2 className="text-lg font-semibold">{t('crash.title')}</h2>
                <p className="mt-1 text-sm text-muted">{t(isApp ? 'crash.appHint' : 'crash.tabHint')}</p>
            </div>
            <code className="max-w-xl break-words rounded-md bg-panel-2 px-3 py-2 text-xs">{error.message}</code>
            <div className="no-drag flex gap-2">
                <Button onClick={() => void copy(details)}>
                    <Copy size={14} />
                    {t('crash.copy')}
                </Button>
                <Button onClick={onRetry}>
                    <RotateCcw size={14} />
                    {t('crash.retry')}
                </Button>
                {isApp && (
                    <Button variant="primary" onClick={() => window.location.reload()}>
                        {t('crash.reload')}
                    </Button>
                )}
            </div>
        </div>
    )
}
