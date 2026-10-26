import { useState } from 'react'
import { ArrowDown, ArrowUp, FolderOpen, Pencil, Plus, Terminal, Trash2 } from 'lucide-react'
import { newClaudeAction, type ClaudeAction } from '@domain/automation/claude-action'
import { useStatuses, useTrackers } from '@/hooks/reference'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { localId } from '@/lib/ids'
import { moveItem } from '@/lib/move-item'
import { Button } from '../../atoms/Button'
import { Input, Select, Textarea } from '../../atoms/fields'
import { IconButton } from '../../atoms/IconButton'
import { ActionIcon } from '../../atoms/ActionIcon'
import { Dialog } from '../../molecules/Dialog'
import { Field } from '../../molecules/Field'
import { IconChoice } from '../../molecules/IconChoice'
import { SegmentedControl } from '../../molecules/SegmentedControl'
import { Card } from '../../molecules/surfaces'
import { useToast } from '../../molecules/Toast'
import { ChipChoice, Labeled } from './HandoffRuleEditor'

const KEEP = ''

/** The "Claude Code" buttons of the issue detail and the cards' menu, in the order they show. */
export function ClaudeActionsSection() {
    const { t, error } = useI18n()
    const toast = useToast()
    const actions = useSettings().claudeActions
    const update = useUpdateSettings()
    const [editing, setEditing] = useState<ClaudeAction>()

    const saveAll = (next: ClaudeAction[], onSaved?: () => void) =>
        update.mutate(
            { claudeActions: next },
            { onSuccess: onSaved, onError: (saveError) => toast(error(saveError), 'error') }
        )
    const saveAction = (action: ClaudeAction) => {
        const exists = actions.some((candidate) => candidate.id === action.id)
        const next = exists
            ? actions.map((candidate) => (candidate.id === action.id ? action : candidate))
            : [...actions, action]
        saveAll(next, () => setEditing(undefined))
    }
    const remove = (action: ClaudeAction) => {
        if (confirm(t('claude.confirmDelete', { name: action.name })))
            saveAll(actions.filter((other) => other !== action))
    }
    const summary = (action: ClaudeAction) =>
        action.mode === 'terminal'
            ? t('claude.terminalSummary', { folder: action.folder ?? '' })
            : t('claude.desktopSummary')

    const newAction = (
        <Button onClick={() => setEditing(newClaudeAction(localId(), ''))}>
            <Plus size={14} /> {t('claude.new')}
        </Button>
    )

    return (
        <Card title={t('claude.title')} description={t('claude.hint')} actions={newAction}>
            {actions.length === 0 && <p className="text-sm text-muted">{t('claude.empty')}</p>}
            <div className="flex flex-col divide-y divide-line">
                {actions.map((action, index) => (
                    <div key={action.id} className="flex items-center gap-3 py-2">
                        <span className="text-muted">
                            <ActionIcon name={action.icon} fallback={Terminal} size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{action.name}</div>
                            <div className="truncate text-xs text-muted">{summary(action)}</div>
                        </div>
                        <IconButton
                            label={t('automation.moveUp')}
                            icon={<ArrowUp size={14} />}
                            size="sm"
                            disabled={index === 0}
                            onClick={() => saveAll(moveItem(actions, index, -1))}
                        />
                        <IconButton
                            label={t('automation.moveDown')}
                            icon={<ArrowDown size={14} />}
                            size="sm"
                            disabled={index === actions.length - 1}
                            onClick={() => saveAll(moveItem(actions, index, 1))}
                        />
                        <IconButton
                            label={t('common.edit')}
                            icon={<Pencil size={14} />}
                            size="sm"
                            onClick={() => setEditing(action)}
                        />
                        <IconButton
                            label={t('claude.delete')}
                            icon={<Trash2 size={14} />}
                            size="sm"
                            tone="danger"
                            onClick={() => remove(action)}
                        />
                    </div>
                ))}
            </div>
            {editing && (
                <ClaudeActionEditor
                    action={editing}
                    saving={update.isPending}
                    onSave={saveAction}
                    onClose={() => setEditing(undefined)}
                />
            )}
        </Card>
    )
}

function ClaudeActionEditor({
    action,
    saving,
    onSave,
    onClose
}: {
    action: ClaudeAction
    saving: boolean
    onSave: (action: ClaudeAction) => void
    onClose: () => void
}) {
    const { t } = useI18n()
    const trackers = useTrackers().data ?? []
    const statuses = useStatuses().data ?? []
    const [draft, setDraft] = useState(action)
    const change = (patch: Partial<ClaudeAction>) => setDraft((current) => ({ ...current, ...patch }))
    const chooseFolder = async () => {
        const folder = await api.app.pickFolder()
        if (folder) change({ folder })
    }

    const footer = (
        <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!draft.name.trim() || saving} onClick={() => onSave(draft)}>
                {t('common.save')}
            </Button>
        </>
    )

    return (
        <Dialog title={t('claude.editorTitle')} onClose={onClose} size="lg" footer={footer}>
            <div className="flex flex-col gap-4">
                <Field label={t('claude.name')}>
                    <Input
                        autoFocus
                        value={draft.name}
                        placeholder={t('claude.namePlaceholder')}
                        onChange={(event) => change({ name: event.target.value })}
                    />
                </Field>
                <Labeled label={t('automation.icon')}>
                    <IconChoice value={draft.icon} fallback={Terminal} onChange={(icon) => change({ icon })} />
                </Labeled>
                <Labeled label={t('claude.mode')} hint={t(`claude.modeHints.${draft.mode}`)}>
                    <SegmentedControl
                        value={draft.mode}
                        options={[
                            { value: 'terminal', label: t('claude.modes.terminal') },
                            { value: 'desktop', label: t('claude.modes.desktop') }
                        ]}
                        onChange={(mode) => change({ mode })}
                    />
                </Labeled>
                {draft.mode === 'terminal' && (
                    <Labeled label={t('claude.folder')}>
                        <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate rounded-md border border-line px-2.5 py-2 font-mono text-xs">
                                {draft.folder || t('claude.noFolder')}
                            </span>
                            <Button onClick={() => void chooseFolder()}>
                                <FolderOpen size={14} /> {t('claude.chooseFolder')}
                            </Button>
                        </div>
                    </Labeled>
                )}
                <Field label={t('claude.template')} hint={t('claude.templateHint')}>
                    <Textarea
                        className="min-h-16 font-mono text-xs"
                        value={draft.template}
                        onChange={(event) => change({ template: event.target.value })}
                    />
                </Field>
                <Field label={t('claude.statusOnOpen')}>
                    <Select
                        value={draft.statusId ?? KEEP}
                        onChange={(event) => change({ statusId: Number(event.target.value) || undefined })}
                    >
                        <option value={KEEP}>{t('claude.keep')}</option>
                        {statuses.map((status) => (
                            <option key={status.id} value={status.id}>
                                {status.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Labeled label={t('automation.trackers')} hint={t('automation.noneMeansAll')}>
                    <ChipChoice
                        options={trackers}
                        chosen={draft.trackerIds}
                        onChange={(trackerIds) => change({ trackerIds })}
                    />
                </Labeled>
                <Labeled label={t('automation.statuses')} hint={t('automation.noneMeansAll')}>
                    <ChipChoice
                        options={statuses}
                        chosen={draft.statusIds}
                        onChange={(statusIds) => change({ statusIds })}
                    />
                </Labeled>
            </div>
        </Dialog>
    )
}
