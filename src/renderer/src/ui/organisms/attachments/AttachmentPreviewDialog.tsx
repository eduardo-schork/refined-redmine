import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppWindow, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { canOpenInSystem, type AttachmentPreview } from '@domain/redmine/attachment-kind'
import type { Attachment } from '@domain/redmine/entities'
import { formatBytes } from '@shared/i18n/format/log'
import { useAttachmentPreview } from '@/hooks/attachments'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { Dialog } from '../../molecules/Dialog'
import { Alert } from '../../molecules/surfaces'

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

/** Shows one previewable attachment at a time; the arrows (buttons or keyboard) go through the others. */
export function AttachmentPreviewDialog({
    attachments,
    index,
    onIndexChange,
    onOpenInSystem,
    onOpenInRedmine,
    onClose
}: {
    attachments: Attachment[]
    index: number
    onIndexChange: (index: number) => void
    onOpenInSystem: (attachment: Attachment) => void
    onOpenInRedmine: (attachment: Attachment) => void
    onClose: () => void
}) {
    const { t, dates, locale } = useI18n()
    const attachment = attachments[index]
    const preview = useAttachmentPreview(attachment.id, true)
    const meta = [formatBytes(attachment.filesize, locale), attachment.author.name, dates.date(attachment.created_on)]
    const actions = (
        <>
            {canOpenInSystem(attachment) && (
                <Button variant="ghost" onClick={() => onOpenInSystem(attachment)}>
                    <AppWindow size={14} /> {t('attachments.openInSystem')}
                </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenInRedmine(attachment)}>
                <ExternalLink size={14} /> {t('attachments.openInRedmine')}
            </Button>
        </>
    )

    return (
        <PreviewFrame
            name={attachment.filename}
            meta={meta}
            index={index}
            total={attachments.length}
            onIndexChange={onIndexChange}
            actions={actions}
            onClose={onClose}
        >
            <PreviewBody preview={preview} />
        </PreviewFrame>
    )
}

/** The preview window: name and details, arrows between the files, extra actions and the content. */
export function PreviewFrame({
    name,
    meta,
    index,
    total,
    onIndexChange,
    actions,
    onClose,
    children
}: {
    name: string
    meta: string[]
    index: number
    total: number
    onIndexChange: (index: number) => void
    actions?: ReactNode
    onClose: () => void
    children: ReactNode
}) {
    const { t } = useI18n()
    const hasSeveral = total > 1
    const go = (step: number) => onIndexChange((index + step + total) % total)
    useArrowKeys(hasSeveral ? go : undefined)

    return (
        <Dialog onClose={onClose} size="xl" bare title={name}>
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{name}</h2>
                    <p className="truncate text-xs text-muted">{meta.join(' · ')}</p>
                </div>
                {hasSeveral && (
                    <div className="flex items-center gap-1">
                        <IconButton
                            label={t('attachments.previous')}
                            icon={<ChevronLeft size={16} />}
                            size="sm"
                            onClick={() => go(-1)}
                        />
                        <span className="w-14 text-center text-xs tabular-nums text-muted">
                            {t('attachments.position', { current: index + 1, total })}
                        </span>
                        <IconButton
                            label={t('attachments.next')}
                            icon={<ChevronRight size={16} />}
                            size="sm"
                            onClick={() => go(1)}
                        />
                    </div>
                )}
                {actions}
                <IconButton label={t('common.close')} icon={<X size={16} />} size="sm" onClick={onClose} />
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-panel-2">{children}</div>
        </Dialog>
    )
}

function PreviewBody({ preview }: { preview: ReturnType<typeof useAttachmentPreview> }) {
    const { t, error } = useI18n()
    if (preview.isError) return <Alert className="m-5">{error(preview.error)}</Alert>
    if (!preview.data) return <p className="p-5 text-sm text-muted">{t('attachments.loading')}</p>
    return <PreviewContent preview={preview.data} />
}

export function PreviewContent({ preview }: { preview: AttachmentPreview }) {
    const { t } = useI18n()
    if (preview.kind === 'video' || preview.kind === 'audio') return <MediaPlayer preview={preview} />
    if (preview.kind === 'image') {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <img src={preview.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
        )
    }
    return (
        <div>
            <pre className="whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed">
                {readableText(preview.text, preview.extension)}
            </pre>
            {preview.truncated && <p className="px-5 pb-5 text-xs text-muted">{t('attachments.truncated')}</p>}
        </div>
    )
}

type MediaPreview = Extract<AttachmentPreview, { kind: 'video' | 'audio' }>

/**
 * Plays from a blob: URL made from the downloaded bytes (the CSP allows blob: only for media). The URL is
 * released when the player goes away.
 */
function MediaPlayer({ preview }: { preview: MediaPreview }) {
    const { t } = useI18n()
    // Remembers which file failed: the arrows reuse this player for the next file.
    const [failedPreview, setFailedPreview] = useState<MediaPreview>()
    const onError = () => setFailedPreview(preview)
    const attachSource = useCallback(
        (player: HTMLMediaElement | null) => {
            if (!player) return
            const sourceUrl = URL.createObjectURL(new Blob([preview.bytes as BlobPart], { type: preview.mimeType }))
            player.src = sourceUrl
            return () => URL.revokeObjectURL(sourceUrl)
        },
        [preview]
    )
    if (failedPreview === preview) return <Alert className="m-5">{t('attachments.cannotPlay')}</Alert>
    const player =
        preview.kind === 'video' ? (
            <video ref={attachSource} controls autoPlay className="max-h-full max-w-full" onError={onError} />
        ) : (
            <audio ref={attachSource} controls autoPlay className="w-full max-w-lg" onError={onError} />
        )
    return <div className="flex h-full items-center justify-center bg-black/80 p-4">{player}</div>
}

/** JSON on one line is unreadable; it is shown indented. Anything else is shown as it is. */
function readableText(text: string, extension: string): string {
    if (extension !== 'json') return text
    try {
        return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
        return text
    }
}

/** ← and → while the preview is open; inputs keep their own arrows. */
function useArrowKeys(onStep: ((step: number) => void) | undefined) {
    const latest = useRef(onStep)
    useEffect(() => {
        latest.current = onStep
    }, [onStep])
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const step = STEP[event.key]
            const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
            if (!step || typing || !latest.current) return
            event.preventDefault()
            latest.current(step)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])
}
