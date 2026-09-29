import { useQuery } from '@tanstack/react-query'
import { activeSprints, pickSprint } from '@domain/sprint/sprint-classifier'
import type { SprintAutoPick } from '@domain/sprint/sprint'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

export function useSprints() {
    const query = useQuery({ queryKey: qk.sprints, queryFn: () => api.sprints.list(), staleTime: 5 * 60_000 })
    const all = query.data?.all ?? []
    return {
        ...query,
        configured: query.data?.configured ?? false,
        all,
        active: activeSprints(all),
        pick: (auto: SprintAutoPick) => pickSprint(all, auto),
        projectName: all[0]?.version.project.name
    }
}

export const useVersionStats = (versionId: number) =>
    useQuery({
        queryKey: qk.versionStats(versionId),
        queryFn: () => api.sprints.stats(versionId),
        staleTime: 2 * 60_000
    })

export const useInspectProject = (projectId?: number) =>
    useQuery({
        queryKey: qk.inspectProject(projectId ?? 0),
        enabled: Boolean(projectId),
        queryFn: () => api.sprints.inspectProject(projectId!)
    })
