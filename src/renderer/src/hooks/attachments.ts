import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'

const FIVE_MINUTES = 5 * 60_000

/** An attachment's content never changes, so it is not fetched again; it leaves memory 5 minutes after last use. */
export const useAttachmentPreview = (id: number, enabled: boolean) =>
    useQuery({
        queryKey: qk.attachmentPreview(id),
        queryFn: () => api.attachments.preview(id),
        enabled,
        staleTime: Infinity,
        gcTime: FIVE_MINUTES,
        retry: false,
        refetchOnWindowFocus: false
    })

export const useOpenAttachment = () => useMutation({ mutationFn: (id: number) => api.attachments.open(id) })
