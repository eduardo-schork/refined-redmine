import { describe, expect, it } from 'vitest'
import type { SupportReport } from '@contracts/api'
import { createI18n } from '@shared/i18n/index'
import { DateFormatter } from '@shared/i18n/format/dates'
import { formatSupportReport } from './support-report'

const report: SupportReport = {
    generatedAt: '2026-09-29T13:00:00.000Z',
    app: { version: '0.1.0', electron: '44.4.5', platform: 'darwin', arch: 'arm64', dataPath: '/tmp/data' },
    os: 'Darwin 25.6.0',
    language: 'pt-BR',
    redmineHost: 'redmine.test',
    userLogin: 'marina.costa',
    monitor: { running: false, lastCheckAt: '2026-09-29T12:59:00.000Z' },
    permission: { status: 'unconfirmed', signed: true, dev: false },
    monitors: [{ id: 'mine', name: '', enabled: true, source: 'mine' }],
    boardCount: 2,
    recentProblems: [
        {
            id: '1',
            at: '2026-09-29T12:58:00.000Z',
            level: 'error',
            type: 'http',
            method: 'GET',
            url: '/issues.json',
            durationMs: 30000,
            bytes: 0,
            attempt: 3,
            errorCode: 'network.timeout'
        }
    ]
}

describe('formatSupportReport', () => {
    it('lists version, system, monitor, permission and recent problems, without secrets', () => {
        const t = createI18n('pt-BR').t
        const text = formatSupportReport(report, t, new DateFormatter('pt-BR', t), () => 'Minhas tarefas', 'pt-BR')
        expect(text).toContain('Versão: 0.1.0 (Electron 44.4.5)')
        expect(text).toContain('Sistema: macOS · arm64 · Darwin 25.6.0')
        expect(text).toContain('Notificações: Não confirmadas')
        expect(text).toContain('GET /issues.json')
        expect(text).toContain('tentativa 3')
        expect(text).not.toMatch(/apiKey|X-Redmine-API-Key/i)
    })
})
