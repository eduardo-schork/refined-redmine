import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ImageIcon } from 'lucide-react'
import type { RedmineLinks } from '@domain/redmine/links'
import { useI18n } from '@/lib/i18n'

// Turns "#1234" references (3+ digits, at line start or after space/parenthesis) into issue links.
const ISSUE_REFERENCE = /(^|[\s(])#(\d{3,})\b/g

const linkIssueReferences = (text: string) =>
    text.replace(ISSUE_REFERENCE, (_match, prefix, id) => `${prefix}[#${id}](/issues/${id})`)

/**
 * Redmine text (Markdown). Raw HTML is ignored. Issue links call `onIssue`, the others open in the browser.
 * Images become links because attachments require a Redmine session.
 */
export function Markdown({
    text,
    links,
    onIssue,
    onExternal
}: {
    text: string
    links: RedmineLinks
    onIssue: (id: number) => void
    onExternal: (url: string) => void
}) {
    const { t } = useI18n()
    const linked = linkIssueReferences(text)
    const follow = (href: string) => {
        const { url, issueId } = links.resolve(href)
        if (issueId) {
            onIssue(issueId)
            return
        }
        onExternal(url)
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
                    img: ({ src, alt }) => (
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
