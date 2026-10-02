export type AttachmentKind =
    'image' | 'pdf' | 'text' | 'video' | 'audio' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'other'

/** What the main process sends to show an attachment inside the app. */
export type AttachmentPreview =
    { kind: 'image'; dataUrl: string } | { kind: 'text'; text: string; truncated: boolean; extension: string }

const MB = 1024 * 1024

/** Larger files are not downloaded for the preview; they can still be opened in the system app or in Redmine. */
export const PREVIEW_MAX_BYTES = { image: 15 * MB, text: 2 * MB }
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

/** Shown inside the app: images Chromium can draw and text files, up to the preview size. */
export function canPreview(attachment: AttachmentFile): boolean {
    const kind = attachmentKind(attachment.filename, attachment.content_type)
    if (kind === 'image') {
        const drawable = BROWSER_IMAGE_EXTENSIONS.has(fileExtension(attachment.filename))
        return drawable && attachment.filesize <= PREVIEW_MAX_BYTES.image
    }
    if (kind === 'text') return attachment.filesize <= PREVIEW_MAX_BYTES.text
    return false
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
