import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { newRule, type HandoffRule } from '@domain/automation/handoff'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { useI18n } from '@/lib/i18n'
import { localId } from '@/lib/ids'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { Card } from '../../molecules/surfaces'
import { useToast } from '../../molecules/Toast'
import { HandoffRuleEditor } from './HandoffRuleEditor'

/** The "trâmite" buttons of the issue detail, in the order they show; each one is edited in a dialog. */
export function HandoffRulesSection() {
    const { t, error } = useI18n()
    const toast = useToast()
    const rules = useSettings().handoffRules
    const update = useUpdateSettings()
    const [editing, setEditing] = useState<HandoffRule>()

    const saveAll = (next: HandoffRule[], onSaved?: () => void) =>
        update.mutate(
            { handoffRules: next },
            { onSuccess: onSaved, onError: (saveError) => toast(error(saveError), 'error') }
        )
    const saveRule = (rule: HandoffRule) => {
        const exists = rules.some((candidate) => candidate.id === rule.id)
        const next = exists ? rules.map((candidate) => (candidate.id === rule.id ? rule : candidate)) : [...rules, rule]
        saveAll(next, () => setEditing(undefined))
    }
    const remove = (rule: HandoffRule) => {
        if (confirm(t('automation.confirmDelete', { name: rule.name })))
            saveAll(rules.filter((other) => other !== rule))
    }
    const move = (index: number, step: number) => {
        const next = [...rules]
        const [moved] = next.splice(index, 1)
        next.splice(index + step, 0, moved)
        saveAll(next)
    }

    const actions = (
        <Button onClick={() => setEditing(newRule(localId(), t('automation.defaultName')))}>
            <Plus size={14} /> {t('automation.new')}
        </Button>
    )

    return (
        <Card title={t('automation.title')} description={t('automation.hint')} actions={actions}>
            {rules.length === 0 && <p className="text-sm text-muted">{t('automation.empty')}</p>}
            <div className="flex flex-col divide-y divide-line">
                {rules.map((rule, index) => (
                    <div key={rule.id} className="flex items-center gap-3 py-2">
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{rule.name}</div>
                            <div className="truncate text-xs text-muted">
                                {rule.mode === 'same' ? t('automation.sameSummary') : t('automation.otherSummary')}
                                {rule.assigneeName ? ` · ${rule.assigneeName}` : ''}
                            </div>
                        </div>
                        <IconButton
                            label={t('automation.moveUp')}
                            icon={<ArrowUp size={14} />}
                            size="sm"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                        />
                        <IconButton
                            label={t('automation.moveDown')}
                            icon={<ArrowDown size={14} />}
                            size="sm"
                            disabled={index === rules.length - 1}
                            onClick={() => move(index, 1)}
                        />
                        <IconButton
                            label={t('common.edit')}
                            icon={<Pencil size={14} />}
                            size="sm"
                            onClick={() => setEditing(rule)}
                        />
                        <IconButton
                            label={t('automation.delete')}
                            icon={<Trash2 size={14} />}
                            size="sm"
                            tone="danger"
                            onClick={() => remove(rule)}
                        />
                    </div>
                ))}
            </div>
            {editing && (
                <HandoffRuleEditor
                    rule={editing}
                    saving={update.isPending}
                    onSave={saveRule}
                    onClose={() => setEditing(undefined)}
                />
            )}
        </Card>
    )
}
