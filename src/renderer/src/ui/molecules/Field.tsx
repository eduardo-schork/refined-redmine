import type { ReactNode } from 'react'
import { Switch } from '../atoms/Switch'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{label}</span>
            {children}
            {hint && <span className="text-xs text-muted">{hint}</span>}
        </label>
    )
}

export function ToggleField({
    checked,
    onChange,
    label,
    description
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
    description?: string
}) {
    return (
        <div className="flex w-full items-start gap-3 py-1.5" onClick={() => onChange(!checked)}>
            <span className="mt-0.5" onClick={(event) => event.stopPropagation()}>
                <Switch checked={checked} onChange={onChange} label={label} />
            </span>
            <span className="flex cursor-default flex-col">
                <span className="text-[13px]">{label}</span>
                {description && <span className="text-xs text-muted">{description}</span>}
            </span>
        </div>
    )
}
