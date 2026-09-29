import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

export const useAppInfo = () => useQuery({ queryKey: qk.appInfo, queryFn: () => api.app.info(), staleTime: Infinity })
