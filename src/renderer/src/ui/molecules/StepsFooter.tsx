import { useI18n } from '@/lib/i18n'
import type { Step, StepOutcome } from '@/lib/steps'
import { Button } from '../atoms/Button'

/**
 * Footer of a multi-step action: Cancel before anything ran, Close after. The main button starts, and after a
 * failure turns into "Try again" (finished steps are skipped); it disappears when nothing is left to do.
 */
export function StepsFooter({
    planned,
    outcomes,
    pending,
    running,
    ready,
    startLabel,
    onStart,
    onClose
}: {
    planned: Step[]
    outcomes: Record<string, StepOutcome>
    pending: number
    running: boolean
    /** The form is complete (something to send). */
    ready: boolean
    startLabel: string
    onStart: () => void
    onClose: () => void
}) {
    const { t } = useI18n()
    const started = planned.some((step) => outcomes[step.key])
    const finished = started && pending === 0 && !running
    const hasFailures = planned.some((step) => outcomes[step.key]?.state === 'failed')
    return (
        <>
            <Button onClick={onClose}>{started ? t('common.close') : t('common.cancel')}</Button>
            {!finished && (
                <Button variant="primary" disabled={!ready || pending === 0 || running} onClick={onStart}>
                    {hasFailures ? t('steps.retry') : startLabel}
                </Button>
            )}
        </>
    )
}
