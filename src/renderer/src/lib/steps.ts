import { useCallback, useState } from 'react'

export type StepState = 'running' | 'done' | 'warning' | 'failed'

/** One request (or group) of a multi-step action. `run` resolves with a warning text, or nothing when all went well. */
export interface Step {
    key: string
    run: () => Promise<string | void>
}

export interface StepOutcome {
    state: StepState
    message?: string
}

const isFinished = (outcome?: StepOutcome) => outcome?.state === 'done' || outcome?.state === 'warning'

/**
 * Runs steps in order and remembers each outcome by key. Running again skips the finished ones, so a retry never
 * repeats a comment or a status change that already went through; a step whose key changed (another choice) runs.
 */
export function useSteps(errorText: (error: unknown) => string) {
    const [outcomes, setOutcomes] = useState<Record<string, StepOutcome>>({})
    const [running, setRunning] = useState(false)

    const run = useCallback(
        async (steps: Step[]): Promise<boolean> => {
            setRunning(true)
            const results: Record<string, StepOutcome> = { ...outcomes }
            const record = (key: string, outcome: StepOutcome) => {
                results[key] = outcome
                setOutcomes((current) => ({ ...current, [key]: outcome }))
            }
            for (const step of steps) {
                if (isFinished(results[step.key])) continue
                record(step.key, { state: 'running' })
                try {
                    const warning = await step.run()
                    record(step.key, warning ? { state: 'warning', message: warning } : { state: 'done' })
                } catch (error) {
                    record(step.key, { state: 'failed', message: errorText(error) })
                }
            }
            setRunning(false)
            return steps.every((step) => results[step.key]?.state === 'done')
        },
        [outcomes, errorText]
    )

    const pending = (steps: Step[]) => steps.filter((step) => !isFinished(outcomes[step.key]))
    return { outcomes, running, run, pending, started: Object.keys(outcomes).length > 0 }
}
