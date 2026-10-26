import type { Issue } from '../redmine/entities'
import { AppError } from '../shared/errors'

/**
 * A button that opens Claude Code with a prompt about the issue, like the redmine-adapter's. `terminal` opens the
 * Claude Code CLI in `folder` (`claude-cli://`); `desktop` starts a new chat in the Claude app (`claude://`).
 */
export interface ClaudeAction {
    id: string
    name: string
    mode: 'terminal' | 'desktop'
    /** Absolute folder the CLI starts in (terminal mode). */
    folder?: string
    /** Prompt with {{tarefa}} (#1234), {{numeroAtividade}} (1234) and {{titulo}}. */
    template: string
    /** Status the issue goes to once Claude opens; undefined = keep. */
    statusId?: number
    /** Where the button shows; empty = every tracker / status. */
    trackerIds: number[]
    statusIds: number[]
    icon?: string
}

export const DEFAULT_CLAUDE_TEMPLATE = '/review refs {{tarefa}}'
export const MAX_CLAUDE_ACTIONS = 30

export function newClaudeAction(id: string, name: string): ClaudeAction {
    return { id, name, mode: 'terminal', template: DEFAULT_CLAUDE_TEMPLATE, trackerIds: [], statusIds: [] }
}

const matches = (allowed: number[], value: number) => allowed.length === 0 || allowed.includes(value)

/** The actions whose button shows on this issue, in the configured order. */
export function claudeActionsFor(actions: ClaudeAction[], issue: Pick<Issue, 'tracker' | 'status'>): ClaudeAction[] {
    return actions.filter(
        (action) => matches(action.trackerIds, issue.tracker.id) && matches(action.statusIds, issue.status.id)
    )
}

export function renderClaudePrompt(template: string, issue: { id: number; subject: string }): string {
    return template
        .replaceAll('{{tarefa}}', `#${issue.id}`)
        .replaceAll('{{numeroAtividade}}', String(issue.id))
        .replaceAll('{{titulo}}', issue.subject)
}

/** Built by hand so spaces become %20, which the Claude links expect (not "+"). */
export function claudeActionUrl(action: ClaudeAction, issue: { id: number; subject: string }): string {
    const prompt = encodeURIComponent(renderClaudePrompt(action.template, issue))
    if (action.mode === 'desktop') return `claude://code/new?q=${prompt}`
    return `claude-cli://open?cwd=${encodeURIComponent(action.folder ?? '')}&q=${prompt}`
}

function cleanAction(action: ClaudeAction): ClaudeAction {
    const name = action.name.trim()
    if (!name) throw new AppError('automation.nameRequired')
    const template = action.template.trim() || DEFAULT_CLAUDE_TEMPLATE
    const folder = action.folder?.trim() || undefined
    if (action.mode === 'terminal' && !folder) throw new AppError('claude.folderRequired', { name })
    return { ...action, name, template, folder }
}

export function assertValidClaudeActions(actions: ClaudeAction[]): ClaudeAction[] {
    if (actions.length > MAX_CLAUDE_ACTIONS) throw new AppError('automation.tooMany', { max: MAX_CLAUDE_ACTIONS })
    return actions.map(cleanAction)
}
