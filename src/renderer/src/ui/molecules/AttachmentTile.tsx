import type { ReactNode } from 'react'
import {
    File,
    FileArchive,
    FileCode,
    FileImage,
    FileMusic,
    FileSpreadsheet,
    FileText,
    FileVideoCamera,
    Presentation
} from 'lucide-react'
import { attachmentKind, type AttachmentKind } from '@domain/redmine/attachment-kind'
import type { Attachment } from '@domain/redmine/entities'
import { formatBytes } from '@shared/i18n/format/log'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

const KIND_ICON: Record<AttachmentKind, typeof File> = {
    image: FileImage,
    pdf: FileText,
    text: FileCode,
    video: FileVideoCamera,
    audio: FileMusic,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    presentation: Presentation,
    archive: FileArchive,
    other: File
}

/** One attachment: thumbnail (images) or the icon of its type, name, size, author and date. */
export function AttachmentTile({
    attachment,
    thumbnailUrl,
    actionLabel,
    onClick
}: {
    attachment: Attachment
    thumbnailUrl?: string
    /** What a click does, shown as the tooltip ("Preview", "Open in the system app"…). */
    actionLabel: string
    onClick: () => void
}) {
    const { dates, locale } = useI18n()
    const kind = attachmentKind(attachment.filename, attachment.content_type)
    const meta = [formatBytes(attachment.filesize, locale), attachment.author.name, dates.date(attachment.created_on)]
    return (
        <button
            type="button"
            onClick={onClick}
            title={`${attachment.filename} · ${actionLabel}`}
            className="group flex min-w-0 cursor-default flex-col overflow-hidden rounded-lg border border-line bg-panel text-left hover:border-accent/60"
        >
            <TileImage thumbnailUrl={thumbnailUrl} fallback={<KindIcon kind={kind} />} />
            <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
                <span className="truncate text-sm group-hover:text-accent">{attachment.filename}</span>
                <span className="truncate text-2xs text-muted">{meta.join(' · ')}</span>
            </span>
        </button>
    )
}

/** Photos and screenshots fill the tile; drawings (SVG) are shown whole. */
function TileImage({ thumbnailUrl, fallback }: { thumbnailUrl?: string; fallback: ReactNode }) {
    const isDrawing = thumbnailUrl?.startsWith('data:image/svg+xml')
    const fit = isDrawing ? 'object-contain p-2' : 'object-cover'
    return (
        <span className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden border-b border-line bg-panel-2">
            {thumbnailUrl ? <img src={thumbnailUrl} alt="" className={cn('h-full w-full', fit)} /> : fallback}
        </span>
    )
}

function KindIcon({ kind }: { kind: AttachmentKind }) {
    const Icon = KIND_ICON[kind]
    return <Icon size={30} strokeWidth={1.5} className="text-muted" />
}
