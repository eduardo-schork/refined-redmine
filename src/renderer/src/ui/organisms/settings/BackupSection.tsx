import { Download, Upload } from 'lucide-react'
import { useBackup } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { Button } from '../../atoms/Button'
import { Card } from '../../molecules/surfaces'
import { useToast } from '../../molecules/Toast'

/** Export the settings to a JSON file and import them back (another computer, or after a mistake). */
export function BackupSection() {
    const { t, error } = useI18n()
    const toast = useToast()
    const { exportBackup, importBackup } = useBackup()

    const exportToFile = () =>
        exportBackup.mutate(undefined, {
            onSuccess: (saved) => {
                if (saved) toast(t('backup.exported'))
            },
            onError: (exportError) => toast(error(exportError), 'error')
        })
    const importFromFile = () => {
        if (!confirm(t('backup.confirmImport'))) return
        importBackup.mutate(undefined, {
            onSuccess: (session) => {
                if (session) toast(t('backup.imported'))
            },
            onError: (importError) => toast(error(importError), 'error')
        })
    }

    return (
        <Card title={t('backup.title')} description={t('backup.description')}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <Button onClick={exportToFile} disabled={exportBackup.isPending}>
                        <Download size={14} /> {t('backup.export')}
                    </Button>
                    <span className="text-xs text-muted">{t('backup.exportHint')}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={importFromFile} disabled={importBackup.isPending}>
                        <Upload size={14} /> {t('backup.import')}
                    </Button>
                    <span className="text-xs text-muted">{t('backup.importHint')}</span>
                </div>
            </div>
        </Card>
    )
}
