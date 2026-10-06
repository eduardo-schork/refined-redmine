import { useMemo } from 'react'
import { canPreview, previewFromBytes } from '@domain/redmine/attachment-kind'
import type { IssueUpload } from '@domain/redmine/issue-upload'
import { formatBytes } from '@shared/i18n/format/log'
import { useI18n } from '@/lib/i18n'
import { Alert } from '../../molecules/surfaces'
import { PreviewContent, PreviewFrame } from './AttachmentPreviewDialog'

const asFile = (upload: IssueUpload) => ({
    filename: upload.filename,
    filesize: upload.bytes.length,
    content_type: upload.contentType
})

/** The files of a new issue, before they are sent: the same preview as the Attachments tab, from local bytes. */
export function UploadPreviewDialog({
    uploads,
    index,
    onIndexChange,
    onClose
}: {
    uploads: IssueUpload[]
    index: number
    onIndexChange: (index: number) => void
    onClose: () => void
}) {
    const { t, locale } = useI18n()
    const previewable = uploads.filter((upload) => canPreview(asFile(upload)))
    const upload = uploads[index]
    const position = previewable.indexOf(upload)
    const preview = useMemo(() => previewFromBytes(asFile(upload), upload.bytes), [upload])
    const showPreviewable = (step: number) => onIndexChange(uploads.indexOf(previewable[step]))

    return (
        <PreviewFrame
            name={upload.filename}
            meta={[formatBytes(upload.bytes.length, locale)]}
            index={position}
            total={previewable.length}
            onIndexChange={showPreviewable}
            onClose={onClose}
        >
            {preview ? (
                <PreviewContent preview={preview} />
            ) : (
                <Alert className="m-5">{t('errors.attachment.notPreviewable')}</Alert>
            )}
        </PreviewFrame>
    )
}
