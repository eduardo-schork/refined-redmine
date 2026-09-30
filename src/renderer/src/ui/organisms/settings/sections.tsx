import {
    ALLDAY_REMINDER_PRESETS,
    DURATION_PRESETS,
    REMINDER_PRESETS,
    type CalendarPreferences
} from '@domain/calendar/calendar-event'
import type { Language, SettingsPatch } from '@domain/settings/settings'
import { humanizeMinutes } from '@shared/i18n/format/dates'
import { useAppInfo } from '@/hooks/app-info'
import { useMonitorName } from '@/hooks/monitor-name'
import { useLogout, useSettings, useUpdateSettings } from '@/hooks/session'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { formatSupportReport } from '@/lib/support-report'
import { Button } from '../../atoms/Button'
import { Input, Select } from '../../atoms/fields'
import { Field, ToggleField } from '../../molecules/Field'
import { HourSelect, ReminderPicker } from '../../molecules/pickers'
import { ScheduleFields } from '../../molecules/ScheduleFields'
import { Card } from '../../molecules/surfaces'
import { useToast } from '../../molecules/Toast'
import { PermissionStatus } from '../NotificationPermission'
import { SprintSetupForm } from '../SprintSetupForm'

function useSave() {
    const update = useUpdateSettings()
    return (patch: SettingsPatch) => update.mutate(patch)
}

const DEFAULT_POLL_SECONDS = 60
const DEFAULT_STALE_DAYS = 5

export function AccountSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const logout = useLogout()

    const confirmLogout = () => {
        if (confirm(t('settings.confirmLogout'))) logout.mutate()
    }

    return (
        <Card
            title={t('settings.account')}
            actions={
                <Button variant="danger" onClick={confirmLogout}>
                    {t('settings.logout')}
                </Button>
            }
        >
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted">{t('settings.redmine')}</dt>
                <dd className="truncate">{settings.baseUrl}</dd>
                <dt className="text-muted">{t('settings.user')}</dt>
                <dd>
                    {settings.user?.firstname} {settings.user?.lastname}{' '}
                    <span className="text-muted">@{settings.user?.login}</span>
                </dd>
            </dl>
        </Card>
    )
}

export function LanguageSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const save = useSave()
    return (
        <Card title={t('settings.language')}>
            <Field label={t('settings.languageLabel')}>
                <Select
                    className="w-64"
                    value={settings.language}
                    onChange={(event) => save({ language: event.target.value as Language })}
                >
                    <option value="system">{t('settings.languageSystem')}</option>
                    <option value="pt-BR">{t('settings.languagePt')}</option>
                    <option value="en-US">{t('settings.languageEn')}</option>
                </Select>
            </Field>
        </Card>
    )
}

export function MonitoringSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const save = useSave()

    const savePollSeconds = (value: string) => save({ pollSeconds: Number(value) || DEFAULT_POLL_SECONDS })

    return (
        <Card title={t('settings.monitoring')} description={t('settings.monitoringHint')}>
            <PermissionStatus />
            <div className="grid grid-cols-2 gap-6">
                <Field label={t('settings.interval')} hint={t('settings.intervalHint')}>
                    <Input
                        type="number"
                        min={30}
                        className="w-32"
                        defaultValue={settings.pollSeconds}
                        onBlur={(event) => savePollSeconds(event.target.value)}
                    />
                </Field>
                <div>
                    <ToggleField
                        checked={settings.sound}
                        onChange={(sound) => save({ sound })}
                        label={t('settings.sound')}
                    />
                    <ToggleField
                        checked={settings.openAtLogin}
                        onChange={(openAtLogin) => save({ openAtLogin })}
                        label={t('settings.openAtLogin')}
                    />
                    <ToggleField
                        checked={settings.reminderHistory}
                        onChange={(reminderHistory) => save({ reminderHistory })}
                        label={t('settings.reminderHistory')}
                        description={t('settings.reminderHistoryHint')}
                    />
                </div>
            </div>
        </Card>
    )
}

export function ScheduleSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const save = useSave()
    return (
        <Card title={t('settings.schedule')} description={t('settings.scheduleHint')}>
            <ScheduleFields
                schedule={settings.schedule}
                label={t('settings.scheduleEnabled')}
                onChange={(schedule) => save({ schedule })}
            />
        </Card>
    )
}

export function SprintsSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const save = useSave()
    const sprintSettings = settings.sprints

    // An empty pattern is ignored so the previous one stays in effect.
    const savePattern = (key: 'sprintPattern' | 'hotfixPattern', pattern: string) => {
        if (!pattern) return
        save({ sprints: { ...sprintSettings, [key]: pattern } })
    }

    return (
        <Card title={t('settings.sprints')} description={t('settings.sprintsHint')}>
            <SprintSetupForm />
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
                <Field label={t('settings.sprintPattern')} hint={t('settings.sprintPatternHint')}>
                    <Input
                        defaultValue={sprintSettings.sprintPattern}
                        onBlur={(event) => savePattern('sprintPattern', event.target.value)}
                    />
                </Field>
                <Field label={t('settings.hotfixPattern')} hint={t('settings.hotfixPatternHint')}>
                    <Input
                        defaultValue={sprintSettings.hotfixPattern}
                        onBlur={(event) => savePattern('hotfixPattern', event.target.value)}
                    />
                </Field>
            </div>
        </Card>
    )
}

export function CalendarSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const save = useSave()
    const calendar = settings.calendar
    const saveCalendar = (patch: Partial<CalendarPreferences>) => save({ calendar: { ...calendar, ...patch } })
    return (
        <Card title={t('settings.calendar')} description={t('settings.calendarHint')}>
            <div className="grid grid-cols-2 gap-5">
                <Field label={t('settings.weekStart')}>
                    <Select
                        value={calendar.weekStartsOn}
                        onChange={(event) => saveCalendar({ weekStartsOn: Number(event.target.value) as 0 | 1 })}
                    >
                        <option value={0}>{t('settings.sunday')}</option>
                        <option value={1}>{t('settings.monday')}</option>
                    </Select>
                </Field>
                <Field label={t('settings.duration')}>
                    <Select
                        value={calendar.defaultDuration}
                        onChange={(event) => saveCalendar({ defaultDuration: Number(event.target.value) })}
                    >
                        {DURATION_PRESETS.map((minutes) => (
                            <option key={minutes} value={minutes}>
                                {humanizeMinutes(minutes, t)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label={t('settings.defaultReminders')}>
                    <ReminderPicker
                        value={calendar.defaultReminders}
                        presets={REMINDER_PRESETS}
                        allDay={false}
                        allDayHour={calendar.allDayReminderHour}
                        onChange={(defaultReminders) => saveCalendar({ defaultReminders })}
                    />
                </Field>
                <Field label={t('settings.defaultAllDayReminders')}>
                    <ReminderPicker
                        value={calendar.defaultAllDayReminders}
                        presets={ALLDAY_REMINDER_PRESETS}
                        allDay
                        allDayHour={calendar.allDayReminderHour}
                        onChange={(defaultAllDayReminders) => saveCalendar({ defaultAllDayReminders })}
                    />
                </Field>
                <Field label={t('settings.allDayHour')}>
                    <HourSelect
                        value={calendar.allDayReminderHour}
                        onChange={(allDayReminderHour) => saveCalendar({ allDayReminderHour })}
                    />
                </Field>
            </div>
        </Card>
    )
}

export function HomeSection() {
    const { t } = useI18n()
    const settings = useSettings()
    const save = useSave()

    const saveStaleDays = (value: string) => {
        const staleDays = Math.max(1, Number(value) || DEFAULT_STALE_DAYS)
        save({ dashboard: { ...settings.dashboard, staleDays } })
    }

    return (
        <Card title={t('settings.home')}>
            <Field label={t('settings.staleDays')}>
                <Input
                    type="number"
                    min={1}
                    className="w-32"
                    defaultValue={settings.dashboard.staleDays}
                    onBlur={(event) => saveStaleDays(event.target.value)}
                />
            </Field>
        </Card>
    )
}

const PLATFORM_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

function useCopySupportReport() {
    const { t, dates, locale } = useI18n()
    const toast = useToast()
    const monitorName = useMonitorName()
    return async () => {
        const report = await api.app.supportReport()
        const text = formatSupportReport(report, t, dates, monitorName, locale)
        await navigator.clipboard.writeText(text)
        toast(t('settings.supportCopied'))
    }
}

export function AboutSection() {
    const { t } = useI18n()
    const info = useAppInfo().data
    const copySupportReport = useCopySupportReport()
    if (!info) return null
    const platform = PLATFORM_NAMES[info.platform] ?? info.platform
    const actions = (
        <>
            <Button onClick={() => void copySupportReport()}>{t('settings.copySupport')}</Button>
            <Button onClick={() => void api.app.openDataFolder()}>{t('settings.openDataFolder')}</Button>
        </>
    )
    return (
        <Card title={t('settings.about')} actions={actions}>
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted">{t('settings.version')}</dt>
                <dd className="font-medium">
                    {t('app.name')} {info.version}
                </dd>
                <dt className="text-muted">{t('settings.system')}</dt>
                <dd>
                    {platform} · {info.arch} · Electron {info.electron}
                </dd>
                <dt className="text-muted">{t('settings.dataFolder')}</dt>
                <dd className="truncate select-text font-mono text-xs">{info.dataPath}</dd>
            </dl>
        </Card>
    )
}
