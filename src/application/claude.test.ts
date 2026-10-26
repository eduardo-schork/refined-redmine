import { describe, expect, it } from 'vitest'
import { newClaudeAction } from '@domain/automation/claude-action'
import { DEFAULT_SETTINGS } from '@domain/settings/settings'
import { OpenClaudeActionUseCase } from './use-cases/claude'
import { MemorySettings } from './testing/fakes'

function setup(openUrl: (url: string) => Promise<void> = async () => {}) {
    const opened: string[] = []
    const copied: string[] = []
    const review = { ...newClaudeAction('review', 'Review'), folder: '/repo' }
    const chat = { ...newClaudeAction('chat', 'Chat'), mode: 'desktop' as const, template: 'Explain {{tarefa}}' }
    const settings = new MemorySettings({ ...DEFAULT_SETTINGS, claudeActions: [review, chat] })
    const launcher = {
        openUrl: async (url: string) => {
            opened.push(url)
            await openUrl(url)
        },
        copyText: (text: string) => void copied.push(text)
    }
    return { opened, copied, useCase: new OpenClaudeActionUseCase(settings, launcher) }
}

const issue = { id: 1201, subject: 'Cupom' }

describe('OpenClaudeActionUseCase', () => {
    it('opens the link built from the saved action', async () => {
        const { opened, copied, useCase } = setup()
        await useCase.execute('review', issue)
        expect(opened).toEqual(['claude-cli://open?cwd=%2Frepo&q=%2Freview%20refs%20%231201'])
        expect(copied).toEqual([])
    })

    it('desktop mode also copies the prompt', async () => {
        const { copied, useCase } = setup()
        await useCase.execute('chat', issue)
        expect(copied).toEqual(['Explain #1201'])
    })

    it('explains how to register the link when nothing opens it', async () => {
        const { useCase } = setup(async () => {
            throw new Error('no handler')
        })
        await expect(useCase.execute('review', issue)).rejects.toMatchObject({ code: 'claude.notRegistered' })
        await expect(useCase.execute('gone', issue)).rejects.toMatchObject({ code: 'claude.actionMissing' })
    })
})
