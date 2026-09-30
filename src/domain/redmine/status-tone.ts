import type { IssueStatus } from './entities'
import type { IssueStyleRules } from './issue-style'
import { isBlockedStatus } from './queue'

/**
 * Color family of a status. Redmine has no status colors in its API, so the app infers one from the status name
 * (Portuguese or English) and from whether the status closes the issue.
 */
export type StatusTone = 'new' | 'progress' | 'review' | 'testing' | 'blocked' | 'done' | 'rejected'

// Checked in order: the first match wins ("Em teste de aprovação" is testing).
const OPEN_STATUS_PATTERNS: [StatusTone, RegExp][] = [
    ['testing', /teste|test|homolog|\bqa\b|valida/i],
    ['review', /aprova|revis|review|approv/i],
    ['progress', /andamento|progress|desenvolv|fazendo|doing|execu|work/i],
    ['done', /resolvid|resolved|finaliz|conclu|pronto|done|entregue/i]
]

const REJECTED = /rejeit|cancel|recus|reject|invalid|duplic|won.?t/i

/** The user's choice for this status wins over the inference from the name. */
export function statusTone(status: IssueStatus, rules?: IssueStyleRules): StatusTone {
    const chosen = rules?.statusTones[status.id]
    if (chosen) return chosen
    if (status.is_closed) return REJECTED.test(status.name) ? 'rejected' : 'done'
    if (isBlockedStatus(status.name)) return 'blocked'
    const match = OPEN_STATUS_PATTERNS.find(([, pattern]) => pattern.test(status.name))
    return match ? match[0] : 'new'
}
