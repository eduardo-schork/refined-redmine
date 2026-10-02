import {
    attachmentKind,
    canOpenInSystem,
    canPreview,
    decodeText,
    fileExtension,
    looksBinary,
    OPEN_MAX_BYTES,
    PREVIEW_MAX_BYTES,
    safeFileName,
    sniffImageType,
    TEXT_PREVIEW_CHARS,
    toBase64,
    type AttachmentPreview
} from '@domain/redmine/attachment-kind'
import type { Attachment } from '@domain/redmine/entities'
import { AppError } from '@domain/shared/errors'
import type { RedmineGateway } from '../ports/redmine-gateway'
import type { FileOpener } from '../ports/system'

/**
 * Attachments shown inside the app or opened in the system app. The name, type and size come from Redmine by id
 * (never from the screen), so the rules always apply to the real file.
 */
export class AttachmentUseCases {
    constructor(
        private readonly gateway: RedmineGateway,
        private readonly opener: FileOpener
    ) {}

    async preview(id: number): Promise<AttachmentPreview> {
        const attachment = await this.gateway.getAttachment(id)
        if (!canPreview(attachment)) throw new AppError('attachment.notPreviewable')
        const kind = attachmentKind(attachment.filename, attachment.content_type)
        if (kind === 'image') return this.imagePreview(attachment)
        return this.textPreview(attachment)
    }

    async open(id: number): Promise<void> {
        const attachment = await this.gateway.getAttachment(id)
        if (!canOpenInSystem(attachment)) throw new AppError('attachment.blockedType')
        const bytes = await this.gateway.downloadAttachment(id, OPEN_MAX_BYTES)
        await this.opener.open(safeFileName(attachment.filename), bytes)
    }

    private async imagePreview(attachment: Attachment): Promise<AttachmentPreview> {
        const bytes = await this.gateway.downloadAttachment(attachment.id, PREVIEW_MAX_BYTES.image)
        const mimeType = sniffImageType(bytes)
        if (!mimeType) throw new AppError('attachment.notPreviewable')
        return { kind: 'image', dataUrl: `data:${mimeType};base64,${toBase64(bytes)}` }
    }

    private async textPreview(attachment: Attachment): Promise<AttachmentPreview> {
        const bytes = await this.gateway.downloadAttachment(attachment.id, PREVIEW_MAX_BYTES.text)
        if (looksBinary(bytes)) throw new AppError('attachment.notPreviewable')
        const text = decodeText(bytes)
        const truncated = text.length > TEXT_PREVIEW_CHARS
        const shown = truncated ? text.slice(0, TEXT_PREVIEW_CHARS) : text
        return { kind: 'text', text: shown, truncated, extension: fileExtension(attachment.filename) }
    }
}
