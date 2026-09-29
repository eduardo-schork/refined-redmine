import { useState } from 'react'
import { useProjects } from '@/hooks/reference'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { useInspectProject } from '@/hooks/sprints'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { Select } from '../atoms/fields'
import { Field } from '../molecules/Field'
import { RichText } from '../molecules/RichText'

function optionalId(value: string): number | undefined {
    return Number(value) || undefined
}

export function SprintSetupForm() {
    const { t } = useI18n()
    const settings = useSettings()
    const update = useUpdateSettings()
    const projects = useProjects()
    const sprintSettings = settings.sprints
    const [projectId, setProjectId] = useState<number | undefined>(sprintSettings.projectId)
    const inspection = useInspectProject(projectId)
    const [devField, setDevField] = useState<number | undefined>(sprintSettings.devDeadlineFieldId)
    const [releaseField, setReleaseField] = useState<number | undefined>(sprintSettings.releaseFieldId)
    const detected = inspection.data
    const dev = devField ?? detected?.devDeadlineFieldId
    const release = releaseField ?? detected?.releaseFieldId

    const placeholder = projects.isLoading ? t('common.loading') : t('common.select')
    const save = () => {
        update.mutate({
            sprints: { ...sprintSettings, projectId, devDeadlineFieldId: dev, releaseFieldId: release }
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <Field label={t('sprints.setup.project')} hint={t('sprints.setup.projectHint')}>
                <Select value={projectId ?? ''} onChange={(event) => setProjectId(optionalId(event.target.value))}>
                    <option value="">{placeholder}</option>
                    {projects.data?.map((project) => (
                        <option key={project.id} value={project.id}>
                            {project.parent ? `${project.parent.name} › ` : ''}
                            {project.name}
                        </option>
                    ))}
                </Select>
            </Field>
            {detected && (
                <>
                    <p className="text-xs text-muted">{t('sprints.setup.found', { count: detected.versionCount })}</p>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label={t('sprints.setup.devField')}>
                            <Select value={dev ?? ''} onChange={(event) => setDevField(optionalId(event.target.value))}>
                                <option value="">{t('common.none')}</option>
                                {detected.fields.map((field) => (
                                    <option key={field.id} value={field.id}>
                                        {field.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label={t('sprints.setup.releaseField')} hint={t('sprints.setup.releaseHint')}>
                            <Select
                                value={release ?? ''}
                                onChange={(event) => setReleaseField(optionalId(event.target.value))}
                            >
                                <option value="">{t('sprints.setup.versionDate')}</option>
                                {detected.fields.map((field) => (
                                    <option key={field.id} value={field.id}>
                                        {field.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                    <p className="text-xs text-muted">
                        <RichText k="sprints.setup.convention" />
                    </p>
                </>
            )}
            <div className="flex justify-end">
                <Button variant="primary" disabled={!projectId} onClick={save}>
                    {t('common.save')}
                </Button>
            </div>
        </div>
    )
}
