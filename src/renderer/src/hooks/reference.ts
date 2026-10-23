import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

const DAY = 24 * 60 * 60 * 1000
const FIVE_MINUTES = 5 * 60 * 1000

export const useStatuses = () =>
    useQuery({ queryKey: qk.statuses, queryFn: () => api.reference.statuses(), staleTime: DAY })
export const useProjects = () =>
    useQuery({ queryKey: qk.projects, queryFn: () => api.reference.projects(), staleTime: DAY })
export const useTrackers = () =>
    useQuery({ queryKey: qk.trackers, queryFn: () => api.reference.trackers(), staleTime: DAY })
export const usePriorities = () =>
    useQuery({ queryKey: qk.priorities, queryFn: () => api.reference.priorities(), staleTime: DAY })
export const useSavedQueries = () =>
    useQuery({ queryKey: qk.savedQueries, queryFn: () => api.reference.savedQueries(), staleTime: FIVE_MINUTES })
