import type { StepProblem } from '@/lib/steps'
import { useI18n } from '@/lib/i18n'
import { StepIcon } from './StepIcon'
import { Alert } from './surfaces'

/** After a multi-step action: each step that did not fully work and why, so the ⚠/✗ icons are not the only hint. */
export function StepProblems({ problems }: { problems: StepProblem[] }) {
    const { t } = useI18n()
    if (!problems.length) return null
    const anyFailed = problems.some((problem) => problem.outcome.state === 'failed')
    return (
        <Alert tone={anyFailed ? 'error' : 'warning'}>
            <p className="font-medium">{t('steps.problems', { count: problems.length })}</p>
            <ul className="mt-1.5 flex flex-col gap-1">
                {problems.map((problem) => (
                    <li key={problem.key} className="flex items-start gap-2">
                        <span className="mt-0.5">
                            <StepIcon outcome={problem.outcome} />
                        </span>
                        <span>
                            <span className="font-medium">{problem.label}</span>
                            {problem.outcome.message && <span> — {problem.outcome.message}</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </Alert>
    )
}
