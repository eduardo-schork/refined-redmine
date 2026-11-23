import { useMemo } from 'react'
import { useRelatedMarks } from '@/hooks/notifications'
import { useStatuses, useTrackers } from '@/hooks/reference'
import type { RelatedMarkView } from '../molecules/RelatedMarkChip'

/** Related issues that monitors saw in a status they wait for, by issue, with the names to show. */
export function useRelatedMarksByIssue(): ReadonlyMap<number, RelatedMarkView[]> {
    const marks = useRelatedMarks().data
    const statuses = useStatuses().data
    const trackers = useTrackers().data
    return useMemo(() => {
        const byIssue = new Map<number, RelatedMarkView[]>()
        for (const mark of marks ?? []) {
            const status = statuses?.find((candidate) => candidate.id === mark.statusId)
            if (!status) continue
            const tracker = trackers?.find((candidate) => candidate.id === mark.trackerId)?.name ?? ''
            const view = { relatedId: mark.relatedId, relatedSubject: mark.relatedSubject, tracker, status }
            byIssue.set(mark.issueId, [...(byIssue.get(mark.issueId) ?? []), view])
        }
        return byIssue
    }, [marks, statuses, trackers])
}
