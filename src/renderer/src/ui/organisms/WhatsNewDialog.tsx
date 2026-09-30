import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import changelog from '../../../../../CHANGELOG.md?raw'
import { RedmineLinks } from '@domain/redmine/links'
import { changelogSection } from '@domain/update/release'
import { useAppInfo } from '@/hooks/app-info'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { Dialog } from '../molecules/Dialog'
import { Markdown } from '../molecules/Markdown'
import { useOpenIssue } from './IssueModal'

/** Shown once after the app is updated: the notes of the installed version, from the bundled CHANGELOG. */
export function WhatsNewDialog() {
    const { t } = useI18n()
    const settings = useSettings()
    const version = useAppInfo().data?.version
    const updateSettings = useUpdateSettings()
    const openIssue = useOpenIssue()
    const links = useMemo(() => new RedmineLinks(settings.baseUrl), [settings.baseUrl])

    const notes = version ? changelogSection(changelog, version) : undefined
    const alreadySeen = settings.lastSeenVersion === version
    if (!version || alreadySeen || notes === undefined) return null

    const close = () => updateSettings.mutate({ lastSeenVersion: version })
    const footer = (
        <Button variant="primary" onClick={close}>
            {t('whatsNew.close')}
        </Button>
    )
    return (
        <Dialog title={t('whatsNew.title', { version })} onClose={close} footer={footer}>
            <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Sparkles size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    {notes ? (
                        <Markdown
                            text={notes}
                            links={links}
                            onIssue={openIssue}
                            onExternal={(url) => void api.app.openExternal(url)}
                        />
                    ) : (
                        <p className="text-[13px] text-muted">{t('whatsNew.empty')}</p>
                    )}
                </div>
            </div>
        </Dialog>
    )
}
