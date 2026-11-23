import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ImageIcon } from 'lucide-react'
import { linkIssueReferences } from '@domain/redmine/issue-reference'
import type { RedmineLinks } from '@domain/redmine/links'
import { useI18n } from '@/lib/i18n'

/**
 * Redmine text (Markdown). Raw HTML is ignored. Issue links (also to a note) call `onIssue`, the others open in the
 * browser. `issueId` is the issue the text belongs to, for "#note-5". `renderImage` draws the images it knows (the
 * issue's attachments); the others become links, because Redmine files require a session.
 */
export function Markdown({
    text,
    links,
    issueId,
    onIssue,
    onExternal,
    renderImage
}: {
    text: string
    links: RedmineLinks
    issueId?: number
    onIssue: (id: number, note?: number) => void
    onExternal: (url: string) => void
    renderImage?: (source: string, alt: string) => ReactNode
}) {
    const { t } = useI18n()
    const linked = linkIssueReferences(text, issueId)
    const follow = (href: string) => {
        const target = links.resolve(href)
        if (target.issueId) {
            onIssue(target.issueId, target.note)
            return
        }
        onExternal(target.url)
    }
    return (
        <div className="md">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children }) => (
                        <a
                            href={href ? links.resolve(href).url : undefined}
                            onClick={(event) => {
                                event.preventDefault()
                                if (href) follow(href)
                            }}
                        >
                            {children}
                        </a>
                    ),
                    img: ({ src, alt }) =>
                        renderImage?.(String(src ?? ''), alt ?? '') ?? (
                            <a
                                href={links.resolve(String(src ?? '')).url}
                                className="inline-flex items-center gap-1"
                                onClick={(event) => {
                                    event.preventDefault()
                                    follow(String(src ?? ''))
                                }}
                            >
                                <ImageIcon size={13} /> {alt || t('issue.image')}
                            </a>
                        )
                }}
            >
                {linked}
            </ReactMarkdown>
        </div>
    )
}
