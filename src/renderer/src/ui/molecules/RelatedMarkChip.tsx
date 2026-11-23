import type { IssueStatus } from '@domain/redmine/entities'
import { StatusTag } from './StatusTag'

/** A related issue (e.g. the Quality one) in a status a monitor waits for. */
export interface RelatedMarkView {
    relatedId: number
    relatedSubject: string
    tracker: string
    status: IssueStatus
}

/**
 * "Qualidade #1220 [Rejeitada]" on cards; `compact` ("#1220 [Rejeitada]") in rows, where the subject needs the room.
 * The tracker and subject are always in the tooltip.
 */
export function RelatedMarkChip({ mark, compact = false }: { mark: RelatedMarkView; compact?: boolean }) {
    const label = compact ? `#${mark.relatedId}` : `${mark.tracker} #${mark.relatedId}`
    return (
        <span
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-2xs text-muted"
            title={`${mark.tracker} #${mark.relatedId} ${mark.relatedSubject}`}
        >
            {label}
            <StatusTag status={mark.status} />
        </span>
    )
}
