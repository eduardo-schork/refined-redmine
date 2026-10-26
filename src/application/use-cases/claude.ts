import { claudeActionUrl, renderClaudePrompt } from '@domain/automation/claude-action'
import { AppError } from '@domain/shared/errors'
import type { SettingsRepository } from '../ports/repositories'
import type { ExternalLauncher } from '../ports/system'

/**
 * Opens Claude for an issue with a saved action. The link is built here from the saved action, never received from
 * the screen, so the screen cannot open other apps. In desktop mode the prompt also goes to the clipboard, in case
 * the Claude app does not fill it in.
 */
export class OpenClaudeActionUseCase {
    constructor(
        private readonly settings: SettingsRepository,
        private readonly launcher: ExternalLauncher
    ) {}

    async execute(actionId: string, issue: { id: number; subject: string }): Promise<void> {
        const action = this.settings.get().claudeActions.find((candidate) => candidate.id === actionId)
        if (!action) throw new AppError('claude.actionMissing')
        if (action.mode === 'desktop') this.launcher.copyText(renderClaudePrompt(action.template, issue))
        try {
            await this.launcher.openUrl(claudeActionUrl(action, issue))
        } catch {
            throw new AppError('claude.notRegistered')
        }
    }
}
