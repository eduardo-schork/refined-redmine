import { describe, expect, it } from 'vitest'
import { AppError } from '../shared/errors'
import {
    assertValidClaudeActions,
    claudeActionsFor,
    claudeActionUrl,
    newClaudeAction,
    renderClaudePrompt
} from './claude-action'

const issue = { id: 1201, subject: 'Cupom & frete' }

describe('Claude actions', () => {
    it('fills the prompt, also with the redmine-adapter placeholder', () => {
        expect(renderClaudePrompt('/review refs {{tarefa}} ({{numeroAtividade}}) {{titulo}}', issue)).toBe(
            '/review refs #1201 (1201) Cupom & frete'
        )
    })

    it('opens the CLI in the folder, with %20 for spaces', () => {
        const action = { ...newClaudeAction('a', 'Review'), folder: '/Users/dev/my repo' }
        expect(claudeActionUrl(action, issue)).toBe(
            'claude-cli://open?cwd=%2FUsers%2Fdev%2Fmy%20repo&q=%2Freview%20refs%20%231201'
        )
    })

    it('starts a chat in the Claude app in desktop mode', () => {
        const action = { ...newClaudeAction('a', 'Review'), mode: 'desktop' as const, template: 'Explain {{tarefa}}' }
        expect(claudeActionUrl(action, issue)).toBe('claude://code/new?q=Explain%20%231201')
    })

    it('shows only on the chosen trackers and statuses', () => {
        const bugOnly = { ...newClaudeAction('a', 'Fix'), trackerIds: [1] }
        const status = { id: 2, name: 'Doing', is_closed: false }
        expect(claudeActionsFor([bugOnly], { tracker: { id: 1, name: 'Bug' }, status })).toHaveLength(1)
        expect(claudeActionsFor([bugOnly], { tracker: { id: 2, name: 'Feature' }, status })).toHaveLength(0)
    })

    it('needs a name, and a folder in terminal mode', () => {
        expect(() => assertValidClaudeActions([newClaudeAction('a', ' ')])).toThrow(AppError)
        expect(() => assertValidClaudeActions([newClaudeAction('a', 'Review')])).toThrow(AppError)
        const desktop = { ...newClaudeAction('a', ' Review '), mode: 'desktop' as const, template: '' }
        expect(assertValidClaudeActions([desktop])[0]).toMatchObject({
            name: 'Review',
            template: '/review refs {{tarefa}}'
        })
    })
})
