import { isHttpUrl } from './links'

export type AttachmentKind =
    'image' | 'pdf' | 'text' | 'video' | 'audio' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'other'

/** What the main process sends to show an attachment inside the app. */
export type AttachmentPreview =
    | { kind: 'image'; dataUrl: string }
    | { kind: 'text'; text: string; truncated: boolean; extension: string }
    | { kind: 'video'; mimeType: string; bytes: Uint8Array }
    | { kind: 'audio'; mimeType: string; bytes: Uint8Array }

const MB = 1024 * 1024

/** Larger files are not downloaded for the preview; they can still be opened in the system app or in Redmine. */
export const PREVIEW_MAX_BYTES = { image: 15 * MB, text: 2 * MB, media: 100 * MB }
/** Images up to this size load their thumbnail as soon as the Attachments tab opens. */
export const THUMBNAIL_MAX_BYTES = 5 * MB
export const OPEN_MAX_BYTES = 200 * MB
/** Characters of a text file shown in the preview. */
export const TEXT_PREVIEW_CHARS = 200_000

const KIND_EXTENSIONS: Record<Exclude<AttachmentKind, 'other'>, string[]> = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'heic', 'tif', 'tiff'],
    pdf: ['pdf'],
    text: [
        ...['txt', 'log', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml', 'ini', 'conf', 'cfg', 'toml'],
        ...['properties', 'env', 'sql', 'diff', 'patch', 'html', 'htm', 'css', 'scss', 'less', 'js', 'mjs', 'cjs'],
        ...['ts', 'tsx', 'jsx', 'vue', 'php', 'py', 'rb', 'java', 'kt', 'cs', 'go', 'rs', 'swift', 'c', 'h', 'cpp'],
        ...['sh', 'bash', 'bat', 'cmd', 'ps1', 'twig', 'blade', 'graphql', 'proto']
    ],
    video: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'],
    document: ['doc', 'docx', 'docm', 'odt', 'rtf', 'pages'],
    spreadsheet: ['xls', 'xlsx', 'xlsm', 'ods', 'numbers'],
    presentation: ['ppt', 'pptx', 'pptm', 'odp', 'key'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz']
}

const KIND_BY_EXTENSION = new Map<string, AttachmentKind>(
    Object.entries(KIND_EXTENSIONS).flatMap(([kind, extensions]) =>
        extensions.map((extension) => [extension, kind as AttachmentKind] as const)
    )
)

/** Used only when the extension is unknown: Redmine guesses the content type from the name, often as octet-stream. */
const KIND_BY_CONTENT_TYPE: [RegExp, AttachmentKind][] = [
    [/^image\//, 'image'],
    [/^application\/pdf$/, 'pdf'],
    [/^text\/|^application\/(json|xml)$/, 'text'],
    [/^video\//, 'video'],
    [/^audio\//, 'audio']
]

/** Formats Chromium shows in an <img>; HEIC and TIFF are images but need the system app. */
const BROWSER_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'])

/**
 * Formats Chromium plays in <video>/<audio>. MOV and M4V share MP4's container; a codec Chromium lacks (HEVC, for
 * instance) fails in the player, which then offers the system app. MKV and AVI go straight to the system app.
 */
const BROWSER_MEDIA_TYPES: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac'
}

/** Kinds handed to the system's default app; archives may carry programs, so they stay in Redmine. */
const OPENABLE_KINDS = new Set<AttachmentKind>([
    'image',
    'pdf',
    'text',
    'video',
    'audio',
    'document',
    'spreadsheet',
    'presentation'
])

/**
 * Never handed to the system: opening them can run code (scripts on Windows, browser pages, Office macros), even
 * when the kind is otherwise fine. They are still shown as text inside the app.
 */
const RUNNABLE_EXTENSIONS = new Set([
    ...['exe', 'msi', 'com', 'scr', 'pif', 'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'js', 'mjs', 'cjs', 'jse', 'wsf'],
    ...['wsh', 'hta', 'lnk', 'reg', 'jar', 'app', 'command', 'sh', 'bash', 'py', 'rb', 'php', 'dmg', 'pkg'],
    ...['html', 'htm', 'xhtml', 'svg', 'url', 'webloc', 'docm', 'xlsm', 'pptm']
])

export function fileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    if (lastDot <= 0) return ''
    return filename.slice(lastDot + 1).toLowerCase()
}

/** The extension decides; the content type only helps when the extension is unknown. */
export function attachmentKind(filename: string, contentType = ''): AttachmentKind {
    const byExtension = KIND_BY_EXTENSION.get(fileExtension(filename))
    if (byExtension) return byExtension
    const match = KIND_BY_CONTENT_TYPE.find(([pattern]) => pattern.test(contentType.toLowerCase()))
    return match ? match[1] : 'other'
}

interface AttachmentFile {
    filename: string
    filesize: number
    content_type?: string
}

const isMedia = (kind: AttachmentKind): kind is 'video' | 'audio' => kind === 'video' || kind === 'audio'

/** Shown inside the app: images Chromium can draw, text files and playable media, up to the preview size. */
export function canPreview(attachment: AttachmentFile): boolean {
    const kind = attachmentKind(attachment.filename, attachment.content_type)
    const extension = fileExtension(attachment.filename)
    if (kind === 'image') {
        const drawable = BROWSER_IMAGE_EXTENSIONS.has(extension)
        return drawable && attachment.filesize <= PREVIEW_MAX_BYTES.image
    }
    if (kind === 'text') return attachment.filesize <= PREVIEW_MAX_BYTES.text
    if (isMedia(kind)) return extension in BROWSER_MEDIA_TYPES && attachment.filesize <= PREVIEW_MAX_BYTES.media
    return false
}

/** How much is downloaded to show the attachment inside the app. */
export function previewMaxBytes(filename: string, contentType = ''): number {
    const kind = attachmentKind(filename, contentType)
    if (kind === 'image') return PREVIEW_MAX_BYTES.image
    if (isMedia(kind)) return PREVIEW_MAX_BYTES.media
    return PREVIEW_MAX_BYTES.text
}

export function canOpenInSystem(attachment: AttachmentFile): boolean {
    const kind = attachmentKind(attachment.filename, attachment.content_type)
    const runnable = RUNNABLE_EXTENSIONS.has(fileExtension(attachment.filename))
    return OPENABLE_KINDS.has(kind) && !runnable && attachment.filesize <= OPEN_MAX_BYTES
}

const IMAGE_SIGNATURES: [number[], string][] = [
    [[0x89, 0x50, 0x4e, 0x47], 'image/png'],
    [[0xff, 0xd8, 0xff], 'image/jpeg'],
    [[0x47, 0x49, 0x46, 0x38], 'image/gif'],
    [[0x42, 0x4d], 'image/bmp'],
    [[0x00, 0x00, 0x01, 0x00], 'image/x-icon']
]

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte)

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))

/**
 * The image type read from the file's first bytes, never from the name or from Redmine: the data URL then always
 * matches what the file really is. Undefined when the bytes are not an image Chromium can draw.
 */
export function sniffImageType(bytes: Uint8Array): string | undefined {
    const signature = IMAGE_SIGNATURES.find(([magic]) => startsWith(bytes, magic))
    if (signature) return signature[1]
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp'
    if (ascii(bytes, 4, 8) === 'ftyp' && ascii(bytes, 8, 12).startsWith('avi')) return 'image/avif'
    const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart().toLowerCase()
    const isSvg = head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))
    return isSvg ? 'image/svg+xml' : undefined
}

/** A NUL byte near the start means a binary file, whatever its name says. */
export function looksBinary(bytes: Uint8Array): boolean {
    return bytes.slice(0, 8000).includes(0)
}

/** UTF-8 when valid; otherwise Windows-1252, the usual encoding of files saved by older Windows tools. */
export function decodeText(bytes: Uint8Array): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
        return new TextDecoder('windows-1252').decode(bytes)
    }
}

const BASE64_CHUNK = 0x8000

export function toBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK))
    }
    return btoa(binary)
}

/**
 * What can be shown inside the app from a file's bytes: an image Chromium can draw (type read from the bytes),
 * playable media (the player refuses what it cannot decode) or text, cut at TEXT_PREVIEW_CHARS. Undefined for
 * anything else, including binaries named as text.
 */
export function previewFromBytes(
    file: Omit<AttachmentFile, 'filesize'>,
    bytes: Uint8Array
): AttachmentPreview | undefined {
    const kind = attachmentKind(file.filename, file.content_type)
    const mediaType = BROWSER_MEDIA_TYPES[fileExtension(file.filename)]
    if (isMedia(kind)) return mediaType ? { kind, mimeType: mediaType, bytes } : undefined
    if (kind === 'image') {
        const mimeType = sniffImageType(bytes)
        return mimeType ? { kind: 'image', dataUrl: `data:${mimeType};base64,${toBase64(bytes)}` } : undefined
    }
    if (kind !== 'text' || looksBinary(bytes)) return undefined
    const text = decodeText(bytes)
    const truncated = text.length > TEXT_PREVIEW_CHARS
    const shown = truncated ? text.slice(0, TEXT_PREVIEW_CHARS) : text
    return { kind: 'text', text: shown, truncated, extension: fileExtension(file.filename) }
}

const MAX_FILE_NAME = 120

/** A name that is safe to create on disk: no folders, no reserved characters, never empty. */
export function safeFileName(filename: string): string {
    const baseName = filename.split(/[/\\]/).pop() ?? ''
    // eslint-disable-next-line no-control-regex
    const cleaned = baseName.replace(/[\u0000-\u001f<>:"|?*]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '')
    if (!cleaned) return 'attachment'
    if (cleaned.length <= MAX_FILE_NAME) return cleaned
    const extension = fileExtension(cleaned)
    const suffix = extension ? `.${extension}` : ''
    return cleaned.slice(0, MAX_FILE_NAME - suffix.length) + suffix
}

const ATTACHMENT_URL = /\/attachments\/(?:download\/|thumbnail\/)?(\d+)(?:[/?#]|$)/

function decodedFileName(source: string): string {
    const lastSegment = source.split(/[?#]/)[0].split('/').pop() ?? ''
    try {
        return decodeURIComponent(lastSegment)
    } catch {
        return lastSegment
    }
}

/**
 * The attachment an image in Redmine text points to. Like Redmine, a relative source such as
 * `![](print.png)` is the issue's attachment with that name (ignoring case, the newest when repeated);
 * links to `/attachments/123` are matched by id. Undefined for anything else (an image on another site).
 */
export function findInlineAttachment<File extends { id: number; filename: string }>(
    source: string,
    attachments: File[]
): File | undefined {
    const byId = source.match(ATTACHMENT_URL)
    if (byId) return attachments.find((attachment) => attachment.id === Number(byId[1]))
    if (isHttpUrl(source)) return undefined
    const name = decodedFileName(source).toLowerCase()
    const sameName = attachments.filter((attachment) => attachment.filename.toLowerCase() === name)
    return sameName.at(-1)
}
