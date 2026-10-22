import type { CustomFieldUsage } from '@domain/redmine/custom-fields'
import { useI18n } from '@/lib/i18n'
import { Input } from '../atoms/fields'
import { Field } from './Field'

/**
 * The tracker's custom fields as text with the values already used as suggestions (a native <datalist>): the
 * options of list fields are only visible to administrators, so Redmine still validates what is typed.
 */
export function CustomFieldInputs({
    fields,
    values,
    onChange
}: {
    fields: CustomFieldUsage[]
    values: Record<number, string>
    onChange: (fieldId: number, value: string) => void
}) {
    const { t } = useI18n()
    if (!fields.length) return null
    return (
        <div className="grid grid-cols-2 gap-4">
            {fields.map((field) => {
                const listId = `custom-field-${field.id}`
                const label = field.required ? `${field.name} *` : field.name
                return (
                    <Field key={field.id} label={label}>
                        <Input
                            list={listId}
                            placeholder={field.required ? t('issue.create.requiredField') : undefined}
                            value={values[field.id] ?? ''}
                            onChange={(event) => onChange(field.id, event.target.value)}
                        />
                        <datalist id={listId}>
                            {field.suggestions.map((suggestion) => (
                                <option key={suggestion} value={suggestion} />
                            ))}
                        </datalist>
                    </Field>
                )
            })}
        </div>
    )
}
