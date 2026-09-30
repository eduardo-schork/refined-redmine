import type { StatusTone } from '@domain/redmine/status-tone'

/** Tailwind classes per status family; written out in full so Tailwind finds them. */
export const STATUS_BACKGROUND: Record<StatusTone, string> = {
    new: 'bg-st-new',
    progress: 'bg-st-progress',
    review: 'bg-st-review',
    testing: 'bg-st-testing',
    blocked: 'bg-st-blocked',
    done: 'bg-st-done',
    rejected: 'bg-st-rejected'
}

export const STATUS_SOFT: Record<StatusTone, string> = {
    new: 'bg-st-new/15 text-fg/85',
    progress: 'bg-st-progress/15 text-st-progress',
    review: 'bg-st-review/15 text-st-review',
    testing: 'bg-st-testing/15 text-st-testing',
    blocked: 'bg-st-blocked/15 text-st-blocked',
    done: 'bg-st-done/15 text-st-done',
    rejected: 'bg-st-rejected/20 text-muted'
}
