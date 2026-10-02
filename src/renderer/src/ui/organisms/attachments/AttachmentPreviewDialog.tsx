import { useEffect, useRef } from 'react'
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
    const hasSeveral = attachments.length > 1
    const go = (step: number) => onIndexChange((index + step + attachments.length) % attachments.length)
    useArrowKeys(hasSeveral ? go : undefined)
    const meta = [formatBytes(attachment.filesize, locale), attachment.author.name, dates.date(attachment.created_on)]

    return (
        <Dialog onClose={onClose} size="xl" bare title={attachment.filename}>
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{attachment.filename}</h2>
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
                            {t('attachments.position', { current: index + 1, total: attachments.length })}
                        </span>
                        <IconButton
                            label={t('attachments.next')}
                            icon={<ChevronRight size={16} />}
                            size="sm"
                            onClick={() => go(1)}
                        />
                    </div>
                )}
                {canOpenInSystem(attachment) && (
                    <Button variant="ghost" onClick={() => onOpenInSystem(attachment)}>
                        <AppWindow size={14} /> {t('attachments.openInSystem')}
                    </Button>
                )}
                <Button variant="ghost" onClick={() => onOpenInRedmine(attachment)}>
                    <ExternalLink size={14} /> {t('attachments.openInRedmine')}
                </Button>
                <IconButton label={t('common.close')} icon={<X size={16} />} size="sm" onClick={onClose} />
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-panel-2">
                <PreviewBody preview={preview} />
            </div>
        </Dialog>
    )
}

function PreviewBody({ preview }: { preview: ReturnType<typeof useAttachmentPreview> }) {
    const { t, error } = useI18n()
    if (preview.isError) return <Alert className="m-5">{error(preview.error)}</Alert>
    if (!preview.data) return <p className="p-5 text-sm text-muted">{t('attachments.loading')}</p>
    return <PreviewContent preview={preview.data} />
}

function PreviewContent({ preview }: { preview: AttachmentPreview }) {
    const { t } = useI18n()
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
