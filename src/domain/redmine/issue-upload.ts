import { AppError } from '../shared/errors'

/** A file the user attached to a new issue. */
export interface IssueUpload {
    filename: string
    /** Type guessed by the system (image/png…); Redmine guesses it by the name when missing. */
    contentType?: string
    bytes: Uint8Array
}

/** A file already sent to Redmine, referred to by its token when the issue is created. */
export interface UploadedFile {
    token: string
    filename: string
    contentType?: string
}

export const MAX_UPLOADS = 10
/** Redmine refuses larger files by its own setting (5 MB by default) with a message of its own. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

const MEGABYTE = 1024 * 1024
const CONTENT_TYPE = /^[\w.+-]+\/[\w.+-]+$/

/** Throws when there are too many files or one of them is too large to send. */
export function assertValidUploads(uploads: IssueUpload[]): void {
    if (uploads.length > MAX_UPLOADS) throw new AppError('issue.tooManyUploads', { max: MAX_UPLOADS })
    const tooLarge = uploads.find((upload) => upload.bytes.length > MAX_UPLOAD_BYTES)
    if (tooLarge) {
        throw new AppError('issue.uploadTooLarge', { name: tooLarge.filename, max: MAX_UPLOAD_BYTES / MEGABYTE })
    }
}

/** Only the file's own name (never a path) and a well-formed type, as Redmine expects them. */
export function cleanUpload(upload: IssueUpload): IssueUpload {
    const name = upload.filename.split(/[\\/]/).pop()?.trim()
    const contentType = upload.contentType && CONTENT_TYPE.test(upload.contentType) ? upload.contentType : undefined
    return { filename: name || 'file', contentType, bytes: upload.bytes }
}
