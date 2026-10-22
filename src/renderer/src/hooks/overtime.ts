import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OvertimeBank, OvertimeDraft } from '@domain/time/overtime'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

export const useOvertime = () => useQuery({ queryKey: qk.overtime, queryFn: () => api.overtime.list() })

/** Every change returns the whole bank, which replaces the cached one. */
function useBankMutation<Input>(change: (input: Input) => Promise<OvertimeBank>) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: change,
        onSuccess: (bank) => queryClient.setQueryData(qk.overtime, bank)
    })
}

export const useAddOvertime = () => useBankMutation((draft: OvertimeDraft) => api.overtime.add(draft))
export const useRemoveOvertime = () => useBankMutation((id: string) => api.overtime.remove(id))
export const useSetMonthPaid = () =>
    useBankMutation(({ month, paid }: { month: string; paid: boolean }) => api.overtime.setPaid(month, paid))
