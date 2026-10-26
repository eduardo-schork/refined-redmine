import { useState, type ClipboardEvent } from 'react'
import type { IssueEditOptions } from '@contracts/api'
import type { Named } from '@domain/redmine/entities'
import { customFieldEntries, trackerCustomFields, type CustomFieldUsage } from '@domain/redmine/custom-fields'
import { MAX_SUBJECT_LENGTH, type NewIssue, type NewIssueDefaults } from '@domain/redmine/issue-edit'
import { parseIssueSearch } from '@domain/redmine/issue-search'
import { attachmentKind, canPreview, previewFromBytes, THUMBNAIL_MAX_BYTES } from '@domain/redmine/attachment-kind'
import { MAX_UPLOAD_BYTES, MAX_UPLOADS, type IssueUpload } from '@domain/redmine/issue-upload'
import { parseHours } from '@domain/time/time-entry'
import { useCreateIssue, useIssueCustomFields, useIssueEditOptions, useIssueTitle } from '@/hooks/issues'
import { usePriorities, useProjects } from '@/hooks/reference'
import { useSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { Input, Select, Textarea } from '../atoms/fields'
import { AttachmentPicker, type PickedFile } from '../molecules/AttachmentPicker'
import { CustomFieldInputs } from '../molecules/CustomFieldInputs'
import { Dialog } from '../molecules/Dialog'
import { Field } from '../molecules/Field'
import { PickList, type PickOption } from '../molecules/PickList'
import { useToast } from '../molecules/Toast'
import { UploadPreviewDialog } from './attachments/UploadPreviewDialog'

const NONE = ''

interface IssueForm {
    projectId?: number
    trackerId?: number
    subject: string
    description: string
    priorityId?: number
    assignedToId?: number
    fixedVersionId?: number
    startDate: string
    dueDate: string
    /** As typed: "8", "1,5", "1h30"; empty = no estimate. */
    estimate: string
    /** As typed: "#1234" or "1234"; empty = no parent. */
    parent: string
    /** By field id; kept when the tracker changes, but only the chosen tracker's fields are sent. */
    customValues: Record<number, string>
}

const toOptions = (items: Named[]): PickOption[] => items.map((item) => ({ value: String(item.id), label: item.name }))
const optionalId = (value: string) => (value ? Number(value) : undefined)

/** Estimate and parent as typed: undefined when empty, null when the text cannot be read. */
function typedEstimate(text: string): number | null | undefined {
    if (!text.trim()) return undefined
    return parseHours(text)
}

function typedParent(text: string): number | null | undefined {
    if (!text.trim()) return undefined
    const reference = parseIssueSearch(text)
    return reference.type === 'id' ? reference.id : null
}

function toNewIssue(form: IssueForm, projectId: number, customFields: CustomFieldUsage[]): NewIssue {
    return {
        projectId,
        trackerId: form.trackerId,
        subject: form.subject,
        description: form.description.trim() ? form.description : undefined,
        priorityId: form.priorityId,
        assignedToId: form.assignedToId,
        fixedVersionId: form.fixedVersionId,
        startDate: form.startDate || undefined,
        dueDate: form.dueDate || undefined,
        estimatedHours: typedEstimate(form.estimate) ?? undefined,
        parentIssueId: typedParent(form.parent) ?? undefined,
        customFields: customFieldEntries(customFields, form.customValues)
    }
}

async function toUpload(file: File): Promise<IssueUpload> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    return { filename: file.name, contentType: file.type || undefined, bytes }
}

interface FormChoices {
    /** The project's trackers, people and versions arrived. */
    loaded: boolean
    projects: PickOption[]
    trackers: PickOption[]
    priorities: PickOption[]
    assignees: PickOption[]
    versions: PickOption[]
}

function formChoices(projects: Named[], priorities: Named[], options?: IssueEditOptions): FormChoices {
    return {
        loaded: Boolean(options),
        projects: toOptions(projects),
        trackers: toOptions(options?.trackers ?? []),
        priorities: toOptions(priorities),
        assignees: toOptions(options?.assignees ?? []),
        versions: toOptions(options?.versions ?? [])
    }
}

/** The sprint project (the company's main one) when the screen gave none. */
function useProjectId(chosen: number | undefined, projects: Named[]): number | undefined {
    const settings = useSettings()
    return chosen ?? settings.sprints.projectId ?? projects[0]?.id
}

function initialForm(defaults: NewIssueDefaults): IssueForm {
    return {
        projectId: defaults.projectId,
        fixedVersionId: defaults.fixedVersionId,
        subject: '',
        description: '',
        startDate: '',
        dueDate: '',
        estimate: '',
        parent: defaults.parentIssueId ? `#${defaults.parentIssueId}` : '',
        customValues: Object.fromEntries((defaults.customFields ?? []).map((entry) => [entry.id, entry.value]))
    }
}

function useTrackerCustomFields(projectId: number | undefined, trackerId: number | undefined) {
    const projectFields = useIssueCustomFields(projectId ?? 0, projectId !== undefined).data
    return projectFields ? trackerCustomFields(projectFields, trackerId) : []
}

/**
 * The form state. Tracker and priority start empty and show Redmine's defaults (the project's first tracker,
 * the default priority) until the user picks one; trackers, people and versions belong to the project.
 */
function useIssueForm(defaults: NewIssueDefaults) {
    const projects = useProjects().data ?? []
    const priorities = usePriorities().data ?? []
    const [form, setForm] = useState(() => initialForm(defaults))
    const projectId = useProjectId(form.projectId, projects)
    const options = useIssueEditOptions(projectId ?? 0, projectId !== undefined).data
    const defaultPriority = priorities.find((priority) => priority.is_default)
    const resolved = {
        projectId,
        trackerId: form.trackerId ?? options?.trackers[0]?.id,
        priorityId: form.priorityId ?? defaultPriority?.id
    }

    const customFields = useTrackerCustomFields(projectId, resolved.trackerId)

    const update = (patch: Partial<IssueForm>) => setForm((current) => ({ ...current, ...patch }))
    const changeProject = (nextProjectId: number) =>
        update({
            projectId: nextProjectId,
            trackerId: undefined,
            assignedToId: undefined,
            fixedVersionId: undefined,
            customValues: {}
        })
    const changeCustomValue = (fieldId: number, value: string) =>
        setForm((current) => ({ ...current, customValues: { ...current.customValues, [fieldId]: value } }))

    const choices = formChoices(projects, priorities, options)
    return { form: { ...form, ...resolved }, choices, customFields, update, changeProject, changeCustomValue }
}

interface FieldsProps {
    form: IssueForm
    choices: FormChoices
    update: (patch: Partial<IssueForm>) => void
}

const idText = (id: number | undefined) => (id === undefined ? NONE : String(id))

function OptionList({ options }: { options: PickOption[] }) {
    return options.map((option) => (
        <option key={option.value} value={option.value}>
            {option.label}
        </option>
    ))
}

function ProjectAndTrackerFields({
    form,
    choices,
    update,
    onProject
}: FieldsProps & { onProject: (projectId: number) => void }) {
    const { t } = useI18n()
    return (
        <div className="grid grid-cols-2 gap-4">
            <Field label={t('issue.project')}>
                <PickList
                    value={idText(form.projectId)}
                    options={choices.projects}
                    disabled={false}
                    searchPlaceholder={t('issue.create.searchProject')}
                    noMatches={t('issue.create.noProject')}
                    onPick={(option) => onProject(Number(option.value))}
                />
            </Field>
            <Field label={t('issue.tracker')}>
                <Select
                    value={idText(form.trackerId)}
                    disabled={!choices.loaded}
                    onChange={(event) => update({ trackerId: Number(event.target.value) })}
                >
                    <OptionList options={choices.trackers} />
                </Select>
            </Field>
        </div>
    )
}

function TextFields({ form, update }: Omit<FieldsProps, 'choices'>) {
    const { t } = useI18n()
    return (
        <>
            <Field label={t('issue.subject')}>
                <Input
                    autoFocus
                    maxLength={MAX_SUBJECT_LENGTH}
                    value={form.subject}
                    onChange={(event) => update({ subject: event.target.value })}
                />
            </Field>
            <Field label={t('issue.description')} hint={t('issue.create.markdownHint')}>
                <Textarea
                    className="min-h-32 font-mono text-xs"
                    value={form.description}
                    onChange={(event) => update({ description: event.target.value })}
                />
            </Field>
        </>
    )
}

function PriorityAndAssigneeFields({ form, choices, update }: FieldsProps) {
    const { t } = useI18n()
    const assignees = [{ value: NONE, label: t('issue.edit.nobody') }, ...choices.assignees]
    return (
        <div className="grid grid-cols-2 gap-4">
            <Field label={t('issue.priority')}>
                <Select
                    value={idText(form.priorityId)}
                    onChange={(event) => update({ priorityId: Number(event.target.value) })}
                >
                    <OptionList options={choices.priorities} />
                </Select>
            </Field>
            <Field label={t('issue.assignee')}>
                <PickList
                    value={idText(form.assignedToId)}
                    options={assignees}
                    disabled={!choices.loaded}
                    searchPlaceholder={t('issue.edit.searchPerson')}
                    noMatches={t('issue.edit.noPerson')}
                    onPick={(option) => update({ assignedToId: optionalId(option.value) })}
                />
            </Field>
        </div>
    )
}

/** Shows the parent's title once the field is left (not on every key: each lookup is a request). */
function ParentHint({ issueId }: { issueId: number | null | undefined }) {
    const { t } = useI18n()
    const parent = useIssueTitle(issueId ?? undefined)
    if (issueId === undefined) return null
    if (issueId === null) return <>{t('issue.edit.invalidParent')}</>
    if (parent.isError) return <>{t('issue.create.parentNotFound')}</>
    if (!parent.data) return null
    return <span className="block truncate">{parent.data.subject}</span>
}

function VersionAndParentFields({ form, choices, update }: FieldsProps) {
    const { t } = useI18n()
    const [lookedUpParent, setLookedUpParent] = useState(() => typedParent(form.parent))
    return (
        <div className="grid grid-cols-2 gap-4">
            <Field label={t('issue.version')}>
                <PickList
                    value={idText(form.fixedVersionId)}
                    options={[{ value: NONE, label: t('issue.edit.noVersion') }, ...choices.versions]}
                    disabled={!choices.loaded}
                    onPick={(option) => update({ fixedVersionId: optionalId(option.value) })}
                />
            </Field>
            <Field label={t('issue.parentField')} hint={<ParentHint issueId={lookedUpParent} />}>
                <Input
                    placeholder="#1234"
                    value={form.parent}
                    onChange={(event) => update({ parent: event.target.value })}
                    onBlur={() => setLookedUpParent(typedParent(form.parent))}
                />
            </Field>
        </div>
    )
}

function DatesAndEstimateFields({ form, update }: Omit<FieldsProps, 'choices'>) {
    const { t } = useI18n()
    const invalidEstimate = typedEstimate(form.estimate) === null
    return (
        <div className="grid grid-cols-3 gap-4">
            <Field label={t('issue.start')}>
                <Input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => update({ startDate: event.target.value })}
                />
            </Field>
            <Field label={t('issue.due')}>
                <Input type="date" value={form.dueDate} onChange={(event) => update({ dueDate: event.target.value })} />
            </Field>
            <Field label={t('issue.estimated')} hint={invalidEstimate && t('issue.edit.invalidHours')}>
                <Input
                    inputMode="decimal"
                    placeholder={t('issue.edit.hoursPlaceholder')}
                    value={form.estimate}
                    onChange={(event) => update({ estimate: event.target.value })}
                />
            </Field>
        </div>
    )
}

const MEGABYTE = 1024 * 1024

/** The tile of a chosen file: small images get a thumbnail, as in the Attachments tab. */
function pickedFile(upload: IssueUpload): PickedFile {
    const file = { filename: upload.filename, filesize: upload.bytes.length, content_type: upload.contentType }
    const isImage = attachmentKind(file.filename, file.content_type) === 'image'
    const preview = isImage && file.filesize <= THUMBNAIL_MAX_BYTES ? previewFromBytes(file, upload.bytes) : undefined
    return {
        name: upload.filename,
        contentType: upload.contentType,
        size: upload.bytes.length,
        thumbnailUrl: preview?.kind === 'image' ? preview.dataUrl : undefined,
        previewable: canPreview(file)
    }
}

/**
 * Files to attach, read when added (so sending is a single step). Files too large to send and files over the
 * limit are refused with a message.
 */
export function useChosenFiles() {
    const { t } = useI18n()
    const toast = useToast()
    const [chosen, setChosen] = useState<{ upload: IssueUpload; tile: PickedFile }[]>([])
    const add = (added: File[]) => {
        for (const file of added.filter((candidate) => candidate.size > MAX_UPLOAD_BYTES)) {
            toast(t('errors.issue.uploadTooLarge', { name: file.name, max: MAX_UPLOAD_BYTES / MEGABYTE }), 'error')
        }
        const accepted = added.filter((file) => file.size <= MAX_UPLOAD_BYTES)
        if (chosen.length + accepted.length > MAX_UPLOADS) {
            toast(t('errors.issue.tooManyUploads', { max: MAX_UPLOADS }), 'error')
        }
        void Promise.all(accepted.map(toUpload)).then((read) => {
            const added = read.map((upload) => ({ upload, tile: pickedFile(upload) }))
            setChosen((current) => [...current, ...added].slice(0, MAX_UPLOADS))
        })
    }
    const remove = (index: number) => setChosen((current) => current.filter((_, position) => position !== index))
    const uploads = chosen.map((item) => item.upload)
    const files = chosen.map((item) => item.tile)
    // A screenshot pasted anywhere in the form becomes an attachment; pasted text is left alone.
    const handlePaste = (event: ClipboardEvent) => {
        const pasted = [...event.clipboardData.files]
        if (!pasted.length) return
        event.preventDefault()
        add(pasted)
    }
    return { uploads, files, add, remove, handlePaste }
}

/** Creates an issue in Redmine and opens it. Defaults come from where it was opened (a board's project and sprint). */
export function IssueCreateDialog({
    defaults,
    onClose,
    onCreated
}: {
    defaults: NewIssueDefaults
    onClose: () => void
    onCreated: (issueId: number) => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const create = useCreateIssue()
    const { form, choices, customFields, update, changeProject, changeCustomValue } = useIssueForm(defaults)
    const attachments = useChosenFiles()
    const [previewIndex, setPreviewIndex] = useState<number | null>(null)
    const projectId = form.projectId
    const readable = typedEstimate(form.estimate) !== null && typedParent(form.parent) !== null
    const canCreate = projectId !== undefined && form.subject.trim() !== '' && readable && !create.isPending

    // No <form>: Enter in the title must not create the issue by accident (Redmine users cannot delete issues).
    const submit = () => {
        if (!canCreate) return
        create.mutate(
            { issue: toNewIssue(form, projectId, customFields), uploads: attachments.uploads },
            {
                onSuccess: (created) => {
                    toast(t('issue.create.created', { id: created.id }))
                    onClose()
                    onCreated(created.id)
                },
                onError: (createError) => toast(error(createError), 'error')
            }
        )
    }

    const footer = (
        <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!canCreate} onClick={submit}>
                {create.isPending ? t('issue.create.creating') : t('issue.create.submit')}
            </Button>
        </>
    )
    const fieldsProps = { form, choices, update }

    return (
        <Dialog title={t('issue.create.title')} onClose={onClose} size="lg" footer={footer}>
            {previewIndex !== null && (
                <UploadPreviewDialog
                    uploads={attachments.uploads}
                    index={previewIndex}
                    onIndexChange={setPreviewIndex}
                    onClose={() => setPreviewIndex(null)}
                />
            )}
            <div className="flex flex-col gap-4" onPaste={attachments.handlePaste}>
                <ProjectAndTrackerFields {...fieldsProps} onProject={changeProject} />
                <TextFields form={form} update={update} />
                <CustomFieldInputs fields={customFields} values={form.customValues} onChange={changeCustomValue} />
                {/* Not a <Field>: its <label> would turn a click anywhere in the list into a click on a button. */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">{t('issue.tabs.attachments')}</span>
                    <AttachmentPicker
                        files={attachments.files}
                        onAdd={attachments.add}
                        onRemove={attachments.remove}
                        onPreview={setPreviewIndex}
                    />
                </div>
                <PriorityAndAssigneeFields {...fieldsProps} />
                <VersionAndParentFields {...fieldsProps} />
                <DatesAndEstimateFields form={form} update={update} />
            </div>
        </Dialog>
    )
}
