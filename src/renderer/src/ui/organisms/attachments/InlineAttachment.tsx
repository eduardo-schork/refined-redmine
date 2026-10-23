import { useState } from 'react'
import { ImageIcon, Paperclip } from 'lucide-react'
import { attachmentKind, canPreview, findInlineAttachment, THUMBNAIL_MAX_BYTES } from '@domain/redmine/attachment-kind'
import type { Attachment } from '@domain/redmine/entities'
import type { RedmineLinks } from '@domain/redmine/links'
import { useAttachmentPreview } from '@/hooks/attachments'
import { api } from '@/lib/api'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import { useOpenInSystem } from './IssueAttachments'

/** Images in the issue's texts that point to its attachments; other images stay as links. */
export function inlineAttachmentRenderer(attachments: Attachment[], links: RedmineLinks) {
    return (source: string, alt: string) => {
        const attachment = findInlineAttachment(source, attachments)
        if (!attachment) return undefined
        return <InlineAttachment attachment={attachment} attachments={attachments} alt={alt} links={links} />
    }
}

/**
 * A small thumbnail in the middle of the text, so a long description with prints stays readable; a click opens
 * the same preview as the Attachments tab. Large images and other files show as a chip.
 */
function InlineAttachment({
    attachment,
    attachments,
    alt,
    links
}: {
    attachment: Attachment
    attachments: Attachment[]
    alt: string
    links: RedmineLinks
}) {
    const [previewIndex, setPreviewIndex] = useState<number | null>(null)
    const openInSystem = useOpenInSystem()
    const previewable = attachments.filter(canPreview)
    const isImage = attachmentKind(attachment.filename, attachment.content_type) === 'image'
    const loadsThumbnail = isImage && canPreview(attachment) && attachment.filesize <= THUMBNAIL_MAX_BYTES
    const thumbnail = useAttachmentPreview(attachment.id, loadsThumbnail)
    const thumbnailUrl = thumbnail.data?.kind === 'image' ? thumbnail.data.dataUrl : undefined
    const openInRedmine = (target: Attachment) => void api.app.openExternal(links.attachment(target.id))

    const open = () => {
        if (canPreview(attachment)) {
            setPreviewIndex(previewable.indexOf(attachment))
            return
        }
        openInRedmine(attachment)
    }

    return (
        <>
            <button
                type="button"
                title={attachment.filename}
                className="my-1 inline-block cursor-zoom-in align-middle"
                onClick={open}
            >
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={alt}
                        className="max-h-32 max-w-64 rounded-md border border-line object-contain hover:border-accent/60"
                    />
                ) : (
                    <FileChip name={alt || attachment.filename} isImage={isImage} />
                )}
            </button>
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

function FileChip({ name, isImage }: { name: string; isImage: boolean }) {
    const icon = isImage ? <ImageIcon size={13} /> : <Paperclip size={13} />
    return (
        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-panel-2 px-2 py-0.5 text-xs">
            {icon} {name}
        </span>
    )
}
