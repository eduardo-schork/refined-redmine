import { useState } from 'react'
import { attachmentKind, canOpenInSystem, canPreview, THUMBNAIL_MAX_BYTES } from '@domain/redmine/attachment-kind'
import type { Attachment } from '@domain/redmine/entities'
import type { RedmineLinks } from '@domain/redmine/links'
import { useAttachmentPreview, useOpenAttachment } from '@/hooks/attachments'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { AttachmentTile } from '../../molecules/AttachmentTile'
import { useToast } from '../../molecules/Toast'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'

interface TileAction {
    label: string
    run: () => void
}

/**
 * The issue's attachments as tiles. A click shows images and text inside the app, opens documents and media in
 * the system app, and sends anything else (archives, programs) to Redmine.
 */
export function IssueAttachments({ attachments, links }: { attachments: Attachment[]; links: RedmineLinks }) {
    const { t } = useI18n()
    const [previewIndex, setPreviewIndex] = useState<number | null>(null)
    const openInSystem = useOpenInSystem()
    const previewable = attachments.filter(canPreview)
    const openInRedmine = (attachment: Attachment) => void api.app.openExternal(links.attachment(attachment.id))

    const actionFor = (attachment: Attachment): TileAction => {
        if (canPreview(attachment)) {
            const index = previewable.indexOf(attachment)
            return { label: t('attachments.preview'), run: () => setPreviewIndex(index) }
        }
        if (canOpenInSystem(attachment)) {
            return { label: t('attachments.openInSystem'), run: () => openInSystem(attachment) }
        }
        return { label: t('attachments.openInRedmine'), run: () => openInRedmine(attachment) }
    }

    return (
        <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
                {attachments.map((attachment) => (
                    <LoadingTile key={attachment.id} attachment={attachment} action={actionFor(attachment)} />
                ))}
            </div>
            {previewIndex !== null && (
                <AttachmentPreviewDialog
                    attachments={previewable}
                    index={previewIndex}
                    onIndexChange={setPreviewIndex}
                    onOpenInSystem={openInSystem}
                    onOpenInRedmine={openInRedmine}
                    onClose={() => setPreviewIndex(null)}
                />
            )}
        </>
    )
}

/** Small images load their thumbnail right away; the same content is reused by the preview. */
function LoadingTile({ attachment, action }: { attachment: Attachment; action: TileAction }) {
    const isImage = attachmentKind(attachment.filename, attachment.content_type) === 'image'
    const loadsThumbnail = isImage && canPreview(attachment) && attachment.filesize <= THUMBNAIL_MAX_BYTES
    const preview = useAttachmentPreview(attachment.id, loadsThumbnail)
    const thumbnailUrl = preview.data?.kind === 'image' ? preview.data.dataUrl : undefined
    return (
        <AttachmentTile
            attachment={attachment}
            thumbnailUrl={thumbnailUrl}
            actionLabel={action.label}
            onClick={action.run}
        />
    )
}

function useOpenInSystem() {
    const { t, error } = useI18n()
    const toast = useToast()
    const open = useOpenAttachment()
    return (attachment: Attachment) => {
        toast(t('attachments.opening', { name: attachment.filename }))
        open.mutate(attachment.id, { onError: (openError) => toast(error(openError), 'error') })
    }
}
