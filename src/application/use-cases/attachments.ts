import {
    canOpenInSystem,
    canPreview,
    OPEN_MAX_BYTES,
    previewFromBytes,
    previewMaxBytes,
    safeFileName,
    type AttachmentPreview
} from '@domain/redmine/attachment-kind'
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
        const maxBytes = previewMaxBytes(attachment.filename, attachment.content_type)
        const bytes = await this.gateway.downloadAttachment(id, maxBytes)
        const preview = previewFromBytes(attachment, bytes)
        if (!preview) throw new AppError('attachment.notPreviewable')
        return preview
    }

    async open(id: number): Promise<void> {
        const attachment = await this.gateway.getAttachment(id)
        if (!canOpenInSystem(attachment)) throw new AppError('attachment.blockedType')
        const bytes = await this.gateway.downloadAttachment(id, OPEN_MAX_BYTES)
        await this.opener.open(safeFileName(attachment.filename), bytes)
    }
}
