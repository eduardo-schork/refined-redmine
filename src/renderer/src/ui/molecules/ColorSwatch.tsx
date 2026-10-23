import { useRef, useState } from 'react'
import { Plus, RotateCcw } from 'lucide-react'
import { isHexColor } from '@domain/settings/colors'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Input } from '../atoms/fields'
import { IconButton } from '../atoms/IconButton'

const PICKER_DELAY_MS = 250

/**
 * Draft shared by the native color picker and the hex text field. Remount (key) when the saved value changes.
 * The picker fires on every mouse move, so it saves only when the user stops dragging; the text saves on blur.
 */
export function useColorDraft(value: string, onChange: (hex: string) => void) {
    const [typed, setTyped] = useState(value)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    const pickLater = (hex: string) => {
        setTyped(hex)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => onChange(hex), PICKER_DELAY_MS)
    }

    const commitTyped = (raw: string) => {
        const hex = (raw.startsWith('#') ? raw : `#${raw}`).toLowerCase()
        if (!isHexColor(hex)) {
            setTyped(value)
            return
        }
        if (hex !== value) onChange(hex)
    }

    const pickerValue = isHexColor(typed) ? typed : value
    return { typed, setTyped, pickLater, commitTyped, pickerValue }
}

/** One color: a round swatch that opens the native picker, the hex value, and "restore" when it was changed. */
export function ColorSwatch({
    label,
    value,
    changed,
    onChange,
    onReset
}: {
    label: string
    value: string
    changed: boolean
    onChange: (hex: string) => void
    onReset: () => void
}) {
    const { t } = useI18n()
    const draft = useColorDraft(value, onChange)
    return (
        <div className="flex items-center gap-2 py-1">
            <label
                title={t('appearance.customColor')}
                className="relative h-6 w-6 shrink-0 cursor-default overflow-hidden rounded-full border border-line"
                style={{ background: draft.pickerValue }}
            >
                <input
                    type="color"
                    aria-label={label}
                    className="absolute inset-0 opacity-0"
                    value={draft.pickerValue}
                    onChange={(event) => draft.pickLater(event.target.value)}
                />
            </label>
            <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
            <Input
                aria-label={label}
                className="w-24 font-mono text-xs"
                value={draft.typed}
                onChange={(event) => draft.setTyped(event.target.value)}
                onBlur={(event) => draft.commitTyped(event.target.value.trim())}
            />
            <IconButton
                size="sm"
                label={t('issueColors.restoreOne')}
                icon={<RotateCcw />}
                onClick={onReset}
                className={changed ? undefined : 'invisible'}
            />
        </div>
    )
}

/**
 * Round "+" button that opens the native picker for any color. Shows the color once one is chosen; `fallback` is
 * where the picker starts when there is none yet.
 */
export function CustomColorButton({
    label,
    value,
    fallback,
    onChange
}: {
    label: string
    value: string | undefined
    fallback: string
    onChange: (hex: string) => void
}) {
    const draft = useColorDraft(value ?? fallback, onChange)
    const chosen = value !== undefined
    return (
        <label
            title={label}
            className={cn(
                'relative flex h-6 w-6 shrink-0 cursor-default items-center justify-center overflow-hidden rounded-full',
                chosen ? 'ring-2 ring-fg/70 ring-offset-2 ring-offset-panel' : 'border border-dashed border-muted'
            )}
            style={chosen ? { background: draft.pickerValue } : undefined}
        >
            {!chosen && <Plus size={13} className="text-muted" />}
            <input
                type="color"
                aria-label={label}
                className="absolute inset-0 opacity-0"
                value={draft.pickerValue}
                onChange={(event) => draft.pickLater(event.target.value)}
            />
        </label>
    )
}
