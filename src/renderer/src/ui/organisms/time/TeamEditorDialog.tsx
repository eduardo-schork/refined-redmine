import { useState } from 'react'
import { X } from 'lucide-react'
import type { Named } from '@domain/redmine/entities'
import { scheduledHoursPerDay } from '@domain/time/business-hours'
import type { Team, TeamMember } from '@domain/time/team'
import { parseHours } from '@domain/time/time-entry'
import { useIssueEditOptions } from '@/hooks/issues'
import { useProjects } from '@/hooks/reference'
import { useSettings, useUpdateSettings } from '@/hooks/session'
import { localId } from '@/lib/ids'
import { useI18n } from '@/lib/i18n'
import { foldForSearch } from '@domain/shared/text'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/fields'
import { Dialog } from '../../molecules/Dialog'
import { Field } from '../../molecules/Field'
import { PickList } from '../../molecules/PickList'
import { useToast } from '../../molecules/Toast'

/**
 * Creates or edits a team. People come from the members of any project (no administrator needed); pick a project,
 * check people, and repeat with other projects if the team spans several.
 */
export function TeamEditorDialog({
    team,
    onClose,
    onSaved
}: {
    team?: Team
    onClose: () => void
    onSaved: (teamId: string) => void
}) {
    const { t, error } = useI18n()
    const toast = useToast()
    const settings = useSettings()
    const update = useUpdateSettings()
    const [name, setName] = useState(team?.name ?? '')
    const [members, setMembers] = useState<TeamMember[]>(team?.members ?? [])

    const persist = (teams: Team[], afterSave: () => void) =>
        update.mutate({ teams }, { onSuccess: afterSave, onError: (saveError) => toast(error(saveError), 'error') })
    const save = () => {
        const saved: Team = { id: team?.id ?? localId(), name, members }
        const others = settings.teams.filter((candidate) => candidate.id !== saved.id)
        persist([...others, saved], () => {
            onSaved(saved.id)
            onClose()
        })
    }
    const remove = () => {
        if (!team || !confirm(t('team.confirmDelete', { name: team.name }))) return
        persist(
            settings.teams.filter((candidate) => candidate.id !== team.id),
            onClose
        )
    }

    const footer = (
        <>
            {team && (
                <Button variant="danger" className="mr-auto" onClick={remove}>
                    {t('team.delete')}
                </Button>
            )}
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!name.trim() || !members.length || update.isPending} onClick={save}>
                {t('team.save')}
            </Button>
        </>
    )

    return (
        <Dialog title={team ? t('team.editTitle') : t('team.newTitle')} onClose={onClose} size="lg" footer={footer}>
            <div className="flex flex-col gap-4">
                <Field label={t('team.name')}>
                    <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
                </Field>
                <ChosenMembers members={members} onChange={setMembers} />
                <MemberPicker members={members} onChange={setMembers} />
            </div>
        </Dialog>
    )
}

function ChosenMembers({ members, onChange }: { members: TeamMember[]; onChange: (members: TeamMember[]) => void }) {
    const { t, dates } = useI18n()
    const scheduleHours = scheduledHoursPerDay(useSettings().workSchedule)
    const setHours = (memberId: number, hoursPerDay: number | undefined) =>
        onChange(members.map((member) => (member.id === memberId ? { ...member, hoursPerDay } : member)))
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">{t('team.members', { count: members.length })}</span>
            {members.length === 0 && <span className="text-sm text-muted">{t('team.noneYet')}</span>}
            {members.length > 0 && (
                <span className="text-xs text-muted">{t('team.hoursHint', { hours: dates.hours(scheduleHours) })}</span>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {members.map((member) => (
                    <div
                        key={member.id}
                        className="flex items-center gap-2 rounded-md bg-panel-2 py-1 pl-2.5 pr-1 text-sm"
                    >
                        <span className="min-w-0 flex-1 truncate">{member.name}</span>
                        <MemberHoursInput
                            member={member}
                            placeholder={dates.hoursInput(scheduleHours)}
                            onChange={(hoursPerDay) => setHours(member.id, hoursPerDay)}
                        />
                        <button
                            aria-label={t('team.removeMember', { name: member.name })}
                            className="rounded-full p-0.5 text-muted hover:text-fg"
                            onClick={() => onChange(members.filter((other) => other.id !== member.id))}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Empty follows the work schedule. Each valid duration counts as it is typed: on macOS clicking "Salvar" does not
 * take the focus away, so waiting for the blur would save the old value. Leaving the field shows the value counted.
 */
function MemberHoursInput({
    member,
    placeholder,
    onChange
}: {
    member: TeamMember
    placeholder: string
    onChange: (hoursPerDay: number | undefined) => void
}) {
    const { t, dates } = useI18n()
    const shown = (hours?: number) => (hours ? dates.hoursInput(hours) : '')
    const [text, setText] = useState(shown(member.hoursPerDay))
    const type = (typed: string) => {
        setText(typed)
        if (!typed.trim()) {
            onChange(undefined)
            return
        }
        const hours = parseHours(typed)
        if (hours !== null) onChange(hours)
    }
    return (
        <Input
            className="w-16"
            value={text}
            placeholder={placeholder}
            aria-label={t('team.hoursPerDay', { name: member.name })}
            title={t('team.hoursPerDay', { name: member.name })}
            onChange={(event) => type(event.target.value)}
            onBlur={() => setText(shown(member.hoursPerDay))}
        />
    )
}

/** Not inside a <Field>: its <label> would turn clicks on the list into clicks on the first checkbox. */
function MemberPicker({ members, onChange }: { members: Named[]; onChange: (members: Named[]) => void }) {
    const { t } = useI18n()
    const projects = useProjects().data ?? []
    const [projectId, setProjectId] = useState<number>()
    const [filter, setFilter] = useState('')
    const people = useIssueEditOptions(projectId ?? 0, projectId !== undefined).data?.assignees ?? []
    const visible = people.filter((person) => foldForSearch(person.name).includes(foldForSearch(filter)))
    const chosen = new Set(members.map((member) => member.id))
    const toggle = (person: Named) =>
        onChange(chosen.has(person.id) ? members.filter((member) => member.id !== person.id) : [...members, person])
    const addAll = () => onChange([...members, ...visible.filter((person) => !chosen.has(person.id))])

    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">{t('team.fromProject')}</span>
            <div className="grid grid-cols-2 gap-3">
                <PickList
                    value={projectId === undefined ? '' : String(projectId)}
                    options={projects.map((project) => ({ value: String(project.id), label: project.name }))}
                    disabled={false}
                    searchPlaceholder={t('issue.create.searchProject')}
                    noMatches={t('issue.create.noProject')}
                    onPick={(option) => setProjectId(Number(option.value))}
                />
                <Input
                    placeholder={t('team.filter')}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                />
            </div>
            {projectId !== undefined && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                    <button
                        className="w-full px-3 py-1.5 text-left text-xs text-accent hover:bg-panel-2"
                        onClick={addAll}
                    >
                        {t('team.checkAll')}
                    </button>
                    {visible.map((person) => (
                        <label
                            key={person.id}
                            className="flex items-center gap-2 border-t border-line px-3 py-1.5 text-sm"
                        >
                            <input type="checkbox" checked={chosen.has(person.id)} onChange={() => toggle(person)} />
                            {person.name}
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}
