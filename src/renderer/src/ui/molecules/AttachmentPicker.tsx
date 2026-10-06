import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Paperclip, X } from 'lucide-react'
import { formatBytes } from '@shared/i18n/format/log'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { IconButton } from '../atoms/IconButton'
import { AttachmentTile } from './AttachmentTile'

export interface PickedFile {
    name: string
    contentType?: string
    size: number
    /** Small images only, as a data URL. */
    thumbnailUrl?: string
    /** Images and text open in the preview. */
    previewable: boolean
}

/**
 * Files chosen for a new issue, as tiles like the Attachments tab: picked, dropped or pasted (the paste is
 * handled by the form). A click previews images and text.
 */
export function AttachmentPicker({
    files,
    onAdd,
    onRemove,
    onPreview
}: {
    files: PickedFile[]
    onAdd: (files: File[]) => void
    onRemove: (index: number) => void
    onPreview: (index: number) => void
}) {
    const { t, locale } = useI18n()
    const inputRef = useRef<HTMLInputElement>(null)
    const choose = () => inputRef.current?.click()
    const preview = (file: PickedFile, index: number) => {
        if (file.previewable) onPreview(index)
    }
    const fileInput = (
        <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
                onAdd([...(event.target.files ?? [])])
                event.target.value = ''
            }}
        />
    )

    if (!files.length) {
        return (
            <DropArea onDrop={onAdd} className="flex items-center gap-2 px-3 py-2.5">
                <Paperclip size={14} className="shrink-0" />
                <span className="flex-1">{t('issue.create.dropFiles')}</span>
                <button
                    type="button"
                    className="cursor-default font-medium text-accent hover:underline"
                    onClick={choose}
                >
                    {t('issue.create.chooseFiles')}
                </button>
                {fileInput}
            </DropArea>
        )
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
            {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative grid">
                    <AttachmentTile
                        filename={file.name}
                        contentType={file.contentType}
                        meta={[formatBytes(file.size, locale)]}
                        thumbnailUrl={file.thumbnailUrl}
                        actionLabel={file.previewable ? t('attachments.preview') : t('issue.create.attachedOnCreate')}
                        onClick={() => preview(file, index)}
                    />
                    <IconButton
                        size="sm"
                        className="absolute right-1.5 top-1.5 bg-panel/90"
                        label={t('issue.create.removeFile', { name: file.name })}
                        icon={<X />}
                        onClick={() => onRemove(index)}
                    />
                </div>
            ))}
            <DropArea onDrop={onAdd} className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                <Paperclip size={18} />
                <button
                    type="button"
                    className="cursor-default font-medium text-accent hover:underline"
                    onClick={choose}
                >
                    {t('issue.create.chooseFiles')}
                </button>
                <span className="text-2xs">{t('issue.create.dropMore')}</span>
                {fileInput}
            </DropArea>
        </div>
    )
}

/** Without preventDefault, a file dropped on the window makes Chromium try to open it. */
function DropArea({
    onDrop,
    className,
    children
}: {
    onDrop: (files: File[]) => void
    className: string
    children: ReactNode
}) {
    const [dragging, setDragging] = useState(false)
    const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
        setDragging(true)
    }
    const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        setDragging(false)
        onDrop([...event.dataTransfer.files])
    }
    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
                'rounded-lg border border-dashed border-line text-sm text-muted',
                dragging && 'border-accent bg-accent/5',
                className
            )}
        >
            {children}
        </div>
    )
}
