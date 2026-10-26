import { useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
    Bold,
    Code,
    Heading2,
    Italic,
    Link2,
    List,
    ListOrdered,
    Quote,
    SquareCode,
    Strikethrough,
    type LucideIcon
} from 'lucide-react'
import type { Attachment } from '@domain/redmine/entities'
import { RedmineLinks } from '@domain/redmine/links'
import { useSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { codeBlock, insertText, prefixLines, wrapSelection, type TextSelection } from '@/lib/markdown-edit'
import { Textarea } from '../atoms/fields'
import { Markdown } from '../molecules/Markdown'
import { inlineAttachmentRenderer } from './attachments/InlineAttachment'
import type { useChosenFiles } from './IssueCreateDialog'

type Edit = (selection: TextSelection) => TextSelection

const TOOLS: { key: string; icon: LucideIcon; edit: Edit }[] = [
    { key: 'bold', icon: Bold, edit: (selection) => wrapSelection(selection, '**') },
    { key: 'italic', icon: Italic, edit: (selection) => wrapSelection(selection, '*') },
    { key: 'strike', icon: Strikethrough, edit: (selection) => wrapSelection(selection, '~~') },
    { key: 'code', icon: Code, edit: (selection) => wrapSelection(selection, '`') },
    { key: 'heading', icon: Heading2, edit: (selection) => prefixLines(selection, () => '## ') },
    { key: 'list', icon: List, edit: (selection) => prefixLines(selection, () => '- ') },
    { key: 'numbered', icon: ListOrdered, edit: (selection) => prefixLines(selection, (index) => `${index + 1}. `) },
    { key: 'quote', icon: Quote, edit: (selection) => prefixLines(selection, () => '> ') },
    { key: 'codeBlock', icon: SquareCode, edit: codeBlock },
    { key: 'link', icon: Link2, edit: (selection) => wrapSelection(selection, '[', '](https://)') }
]

/** Every pasted image gets its own name: screenshots all come as "image.png", and the text points to the name. */
function namePastedFile(file: File, index: number): File {
    if (!file.type.startsWith('image/')) return file
    const extension = file.type.split('/')[1] || 'png'
    const suffix = index > 0 ? `-${index}` : ''
    return new File([file], `clipboard-${Date.now()}${suffix}.${extension}`, { type: file.type })
}

const imageMarkdown = (files: File[]) =>
    files
        .filter((file) => file.type.startsWith('image/'))
        .map((file) => `![](${file.name})`)
        .join('\n')

/**
 * Markdown field like Redmine's: Write / Preview, a formatting bar, and (with `files`) pasted images attached and
 * placed in the text as `![](name)`. The preview shows the issue's attachments and the files about to be sent.
 */
export function MarkdownEditor({
    value,
    onChange,
    files,
    attachments = [],
    placeholder,
    autoFocus,
    disabled,
    className,
    onKeyDown
}: {
    value: string
    onChange: (value: string) => void
    files?: ReturnType<typeof useChosenFiles>
    attachments?: Attachment[]
    placeholder?: string
    autoFocus?: boolean
    disabled?: boolean
    /** Height of the text area. */
    className?: string
    onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}) {
    const { t } = useI18n()
    const [previewing, setPreviewing] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const apply = (edit: Edit) => {
        const textarea = textareaRef.current
        if (!textarea) return
        const next = edit({ text: value, start: textarea.selectionStart, end: textarea.selectionEnd })
        onChange(next.text)
        requestAnimationFrame(() => {
            textarea.focus()
            textarea.setSelectionRange(next.start, next.end)
        })
    }

    const handlePaste = (event: ClipboardEvent) => {
        const pasted = [...event.clipboardData.files]
        if (!files || !pasted.length) return
        event.preventDefault()
        // The form around may also take pasted files: these are handled here.
        event.stopPropagation()
        const named = pasted.map(namePastedFile)
        files.add(named)
        const images = imageMarkdown(named)
        if (!images) return
        // An image goes on a line of its own.
        apply((selection) => {
            const midLine = selection.start > 0 && selection.text[selection.start - 1] !== '\n'
            return insertText(selection, midLine ? `\n${images}` : images)
        })
    }

    return (
        <div className="overflow-hidden rounded-md border border-line focus-within:border-accent">
            <div className="flex items-center gap-0.5 border-b border-line bg-panel-2 px-1.5 py-1">
                <ModeButton active={!previewing} onClick={() => setPreviewing(false)}>
                    {t('markdown.write')}
                </ModeButton>
                <ModeButton active={previewing} onClick={() => setPreviewing(true)}>
                    {t('markdown.preview')}
                </ModeButton>
                {!previewing && (
                    <div role="toolbar" aria-label={t('markdown.toolbar')} className="ml-auto flex items-center">
                        {TOOLS.map(({ key, icon: Icon, edit }) => (
                            <button
                                key={key}
                                type="button"
                                title={t(`markdown.${key}` as 'markdown.bold')}
                                aria-label={t(`markdown.${key}` as 'markdown.bold')}
                                disabled={disabled}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => apply(edit)}
                                className="flex h-7 w-7 cursor-default items-center justify-center rounded text-muted hover:bg-panel hover:text-fg disabled:opacity-50"
                            >
                                <Icon size={14} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {previewing ? (
                <Preview text={value} attachments={attachments} files={files} className={className} />
            ) : (
                <Textarea
                    ref={textareaRef}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={onKeyDown}
                    className={cn('block rounded-none border-0 font-mono text-xs leading-relaxed', className)}
                />
            )}
            {files && !previewing && (
                <p className="border-t border-line px-2.5 py-1 text-2xs text-muted">{t('markdown.pasteHint')}</p>
            )}
        </div>
    )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'h-7 cursor-default rounded px-2.5 text-xs font-medium',
                active ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'
            )}
        >
            {children}
        </button>
    )
}

function Preview({
    text,
    attachments,
    files,
    className
}: {
    text: string
    attachments: Attachment[]
    files?: ReturnType<typeof useChosenFiles>
    className?: string
}) {
    const { t } = useI18n()
    const links = new RedmineLinks(useSettings().baseUrl)
    const openExternal = (url: string) => void api.app.openExternal(url)
    const issueAttachment = inlineAttachmentRenderer(attachments, links)
    // Files not sent yet are shown from their local thumbnail.
    const renderImage = (source: string, alt: string) => {
        const pending = files?.files.find((file) => file.name === source && file.thumbnailUrl)
        if (pending) return <img src={pending.thumbnailUrl} alt={alt} className="max-h-32 rounded border border-line" />
        return issueAttachment(source, alt)
    }
    return (
        <div className={cn('min-h-24 overflow-y-auto px-3 py-2', className)}>
            {text.trim() ? (
                <Markdown
                    text={text}
                    links={links}
                    onIssue={(id) => openExternal(links.issue(id))}
                    onExternal={openExternal}
                    renderImage={renderImage}
                />
            ) : (
                <p className="text-sm italic text-muted">{t('markdown.emptyPreview')}</p>
            )}
        </div>
    )
}
