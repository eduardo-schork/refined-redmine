import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import type { StepOutcome } from '@/lib/steps'

/** ✓ done, ⚠ done with a warning, ✗ failed, spinner while running; the message shows on hover. */
export function StepIcon({ outcome }: { outcome?: StepOutcome }) {
    if (!outcome) return null
    const icons = {
        running: <Loader2 size={14} className="animate-spin text-muted" />,
        done: <Check size={14} className="text-ok" />,
        warning: <AlertTriangle size={14} className="text-warn" />,
        failed: <X size={14} className="text-danger" />
    }
    return (
        <span title={outcome.message} className="inline-flex shrink-0">
            {icons[outcome.state]}
        </span>
    )
}
