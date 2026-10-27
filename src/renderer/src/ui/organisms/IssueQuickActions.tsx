import { useState } from 'react'
import { Clock, Layers, Timer, UserCheck } from 'lucide-react'
import type { IssueDetail } from '@domain/redmine/entities'
import { useChangeIssueStatus, useEditIssue } from '@/hooks/issues'
import { useStatuses } from '@/hooks/reference'
import { useSettings } from '@/hooks/session'
import { useTimer, useTimerActions } from '@/hooks/time'
import { useI18n } from '@/lib/i18n'
import { ActionButton } from '../atoms/ActionButton'
import { useToast } from '../molecules/Toast'
import { BulkEditDialog } from './BulkEditDialog'
import { ClaudeActionButtons } from './ClaudeActions'
import { HandoffButtons } from './handoff/HandoffButtons'
import { TimeEntryDialog } from './time/TimeEntryDialog'

/** Takes the issue for the signed-in user. Hidden when the issue is already theirs. */
function AssignToMeButton({ issue }: { issue: IssueDetail }) {
    const { t, error } = useI18n()
    const toast = useToast()
    const me = useSettings().user
    const edit = useEditIssue(issue.id)
    const alreadyMine = issue.assigned_to?.id === me?.id
    if (!me || alreadyMine) return null

    const assign = () => {
        edit.mutate(
            { assignedToId: me.id },
            {
                onSuccess: (result) => {
                    const applied = !result.ignored.includes('assignedToId')
                    if (applied) toast(t('issue.assignToMe.done', { id: issue.id }))
                    else toast(t('issue.assignToMe.ignored'), 'error')
                },
                onError: (assignError) => toast(error(assignError), 'error')
            }
        )
    }

    return (
        <ActionButton
            tone="accent"
            disabled={edit.isPending}
            onClick={assign}
            title={t('issue.assignToMe.hint')}
            className="font-medium"
        >
            <UserCheck />
            {edit.isPending ? t('issue.assignToMe.saving') : t('issue.assignToMe.label')}
        </ActionButton>
    )
}

function LogTimeButton({ issue }: { issue: IssueDetail }) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    return (
        <>
            <ActionButton onClick={() => setOpen(true)} title={t('time.logHint')}>
                <Clock />
                {t('time.log')}
            </ActionButton>
            {open && (
                <TimeEntryDialog issue={{ id: issue.id, subject: issue.subject }} onClose={() => setOpen(false)} />
            )}
        </>
    )
}

function BulkEditButton({ issue }: { issue: IssueDetail }) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    return (
        <>
            <ActionButton onClick={() => setOpen(true)} title={t('bulk.hint')}>
                <Layers />
                {t('bulk.button')}
            </ActionButton>
            {open && <BulkEditDialog issue={issue} onClose={() => setOpen(false)} />}
        </>
    )
}

/**
 * Starts the stopwatch on this issue. With a stopwatch already on this issue it pauses/resumes it; with one on
 * another issue it asks first, because starting here discards that time.
 */
function TimerButton({ issue }: { issue: IssueDetail }) {
    const { t } = useI18n()
    const timer = useTimer().data
    const actions = useTimerActions()
    const moveOnStart = useStatusOnTimerStart(issue)
    const onThisIssue = timer?.issueId === issue.id
    const running = Boolean(timer?.runningSince)

    const start = () => {
        const replacing = timer && !onThisIssue
        if (replacing && !confirm(t('timer.confirmReplace', { id: timer.issueId }))) return
        actions.start.mutate({ id: issue.id, subject: issue.subject }, { onSuccess: moveOnStart })
    }
    const toggle = () => {
        if (running) actions.pause.mutate()
        else actions.resume.mutate()
    }
    const hereLabel = running ? t('timer.runningHere') : t('timer.pausedHere')
    const label = onThisIssue ? hereLabel : t('timer.start')

    return (
        <ActionButton
            tone={onThisIssue ? 'accent' : 'plain'}
            onClick={onThisIssue ? toggle : start}
            title={t('timer.hint')}
        >
            <Timer />
            {label}
        </ActionButton>
    )
}

/** The status chosen in Settings → Automations ("In progress"), set when the stopwatch starts on the issue. */
function useStatusOnTimerStart(issue: IssueDetail) {
    const { t, error } = useI18n()
    const toast = useToast()
    const targetId = useSettings().timerStartStatusId
    const statusName = useStatuses().data?.find((status) => status.id === targetId)?.name ?? String(targetId)
    const changeStatus = useChangeIssueStatus(issue.id)
    return () => {
        if (!targetId || issue.status.id === targetId) return
        const allowed = issue.allowed_statuses.some((status) => status.id === targetId)
        if (!allowed) {
            toast(t('timer.statusNotAllowed', { id: issue.id, status: statusName }), 'error')
            return
        }
        changeStatus.mutate(targetId, {
            onSuccess: () => toast(t('timer.statusChanged', { id: issue.id, status: statusName })),
            onError: (changeError) => toast(error(changeError), 'error')
        })
    }
}

/** Quick actions of the issue detail: trâmites, take the issue, log time, stopwatch and bulk edit. */
export function IssueQuickActions({ issue }: { issue: IssueDetail }) {
    const { t } = useI18n()
    return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t('issueMenu.label')}>
            <HandoffButtons issue={issue} otherActions={<ClaudeActionButtons issue={issue} />} />
            <AssignToMeButton issue={issue} />
            <LogTimeButton issue={issue} />
            <TimerButton issue={issue} />
            <BulkEditButton issue={issue} />
        </div>
    )
}
