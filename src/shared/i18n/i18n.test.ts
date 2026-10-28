import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@domain/notification/notification'
import { createI18n, resolveLocale } from './index'
import { ptBR } from './locales/pt-BR'
import { enUS } from './locales/en-US'
import { DateFormatter } from './format/dates'
import { describeRecurrence, describeReminder } from './format/recurrence'
import { describeLogEntry, formatBytes } from './format/log'
import { describeSources, formatNotification, systemNotificationText } from './format/notification'
import { errorMessage } from './format/errors'

function keysOf(resources: object, prefix = ''): string[] {
    return Object.entries(resources).flatMap(([key, value]) => {
        const path = `${prefix}${key}`
        if (typeof value === 'object') return keysOf(value, `${path}.`)
        return [path]
    })
}

describe('resources', () => {
    it('en-US has exactly the same keys as pt-BR', () => expect(keysOf(enUS).sort()).toEqual(keysOf(ptBR).sort()))
    it('resolves the system language', () => {
        expect(resolveLocale('system', 'pt-PT')).toBe('pt-BR')
        expect(resolveLocale('system', 'en-GB')).toBe('en-US')
        expect(resolveLocale('system', 'es-ES')).toBe('pt-BR')
        expect(resolveLocale('en-US', 'pt-BR')).toBe('en-US')
    })
})

describe('formatters (pt-BR)', () => {
    const i18n = createI18n('pt-BR')
    const t = i18n.t
    const dates = new DateFormatter('pt-BR', t)
    const start = new Date(2026, 8, 28, 9) // Monday

    it('recurrence', () => {
        expect(describeRecurrence(undefined, start, t, dates)).toBe('Não se repete')
        expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }, start, t, dates)).toBe(
            'Todos os dias úteis (seg a sex)'
        )
        expect(describeRecurrence({ freq: 'weekly', interval: 2, byWeekday: [1, 3] }, start, t, dates)).toBe(
            'A cada 2 semanas: seg, qua'
        )
        expect(
            describeRecurrence(
                { freq: 'monthly', interval: 1, monthlyMode: 'weekday', monthlyNth: -1 },
                start,
                t,
                dates
            )
        ).toBe('Mensal na última segunda-feira')
        expect(
            describeRecurrence(
                { freq: 'monthly', interval: 1, monthlyMode: 'weekday', monthlyNth: 1 },
                new Date(2026, 9, 3),
                t,
                dates
            )
        ).toBe('Mensal no primeiro sábado')
        expect(describeRecurrence({ freq: 'monthly', interval: 1, monthlyMode: 'lastWorkday' }, start, t, dates)).toBe(
            'Mensal no último dia útil'
        )
        expect(describeRecurrence({ freq: 'daily', interval: 1, until: '2026-10-02' }, start, t, dates)).toBe(
            'Todos os dias, até 02/10/2026'
        )
    })

    it('reminders', () => {
        expect(describeReminder(5, false, 9, t)).toBe('5 minutos antes')
        expect(describeReminder(60, false, 9, t)).toBe('1 h antes')
        expect(describeReminder(1440, false, 9, t)).toBe('1 dia antes')
        expect(describeReminder(1440, true, 9, t)).toBe('1 dia antes às 09h')
        expect(describeReminder(0, true, 9, t)).toBe('No dia às 09h')
    })

    it('status change notification', () => {
        const notification: AppNotification = {
            id: '1',
            kind: 'status',
            issueId: 2001,
            target: { type: 'url', url: 'x' },
            createdAt: '',
            read: false,
            payload: {
                type: 'issueChanged',
                actor: 'Lucas',
                issue: { id: 2001, subject: 'Pagamento via Pix' },
                changes: [{ type: 'statusChanged', from: 'Em aprovação', to: 'Em andamento' }]
            }
        }
        expect(formatNotification(notification, t, dates, new Date())).toEqual({
            title: 'Status alterado · #2001',
            body: 'Pagamento via Pix\nLucas Em aprovação → Em andamento'
        })
    })

    it('membership change of a board, with the monitor that saw it', () => {
        const notification: AppNotification = {
            id: '2',
            kind: 'query',
            target: { type: 'url', url: 'x' },
            createdAt: '',
            read: false,
            sources: [
                { monitorId: 'mine', name: '' },
                { monitorId: 'board:b', name: 'Sprint' },
                { monitorId: 'q', name: 'Bugs' }
            ],
            payload: {
                type: 'queryChanged',
                queryName: 'Sprint',
                from: 3,
                to: 3,
                added: [{ id: 7, subject: 'Novo' }],
                removed: [{ id: 5, subject: 'Antigo' }]
            }
        }
        expect(systemNotificationText(notification, t, dates, new Date())).toEqual({
            title: 'Sprint',
            body: '3 → 3 (0)\nEntraram: #7 Novo\nSaíram: #5 Antigo\nvia Minhas tarefas, monitor Bugs'
        })
    })

    it('always says where a notification came from: my issues, a board or a monitor', () => {
        const base: AppNotification = {
            id: 'n3',
            kind: 'status',
            target: { type: 'url', url: 'x' },
            createdAt: '',
            read: false,
            payload: { type: 'queryCount', queryName: 'Outra', count: 1, op: 'below', value: 2 }
        }
        const via = (sources: AppNotification['sources']) => describeSources({ ...base, sources }, t)
        expect(via([{ monitorId: 'mine', name: '' }])).toBe('via Minhas tarefas')
        expect(via([{ monitorId: 'board:b1', name: 'Sprint atual' }])).toBe('via quadro Sprint atual')
        expect(via([{ monitorId: 'x1', name: 'Ágil', sourceType: 'board' }])).toBe('via quadro Ágil')
        expect(via([{ monitorId: 'x2', name: 'Fila do Rafael', sourceType: 'query' }])).toBe(
            'via monitor Fila do Rafael'
        )
        expect(via(undefined)).toBeUndefined()
    })

    it('count alert of a query', () => {
        const notification: AppNotification = {
            id: 'n2',
            kind: 'query',
            createdAt: '2026-09-28T12:00:00Z',
            read: false,
            target: { type: 'url', url: 'https://redmine.example.com/issues' },
            payload: { type: 'queryCount', queryName: 'Fila da Ana', count: 1, op: 'below', value: 2 }
        }
        expect(systemNotificationText(notification, t, dates, new Date())).toEqual({
            title: 'Fila da Ana',
            body: 'Agora com 1 tarefa (menos de 2)'
        })
    })

    it('log lines', () => {
        const request = {
            id: '1',
            at: '',
            level: 'info' as const,
            type: 'http' as const,
            method: 'GET',
            url: '/issues.json?limit=100',
            status: 200,
            durationMs: 250,
            bytes: 2048,
            attempt: 1
        }
        expect(describeLogEntry(request, t, (id) => id, 'pt-BR')).toBe(
            'GET /issues.json?limit=100 · 200 · 250 ms · 2 KB'
        )
        const skipped = {
            id: '2',
            at: '',
            level: 'warn' as const,
            type: 'monitor' as const,
            event: 'monitorSkipped' as const,
            params: { monitor: 'board:b', reason: 'boardMissing' }
        }
        expect(describeLogEntry(skipped, t, () => 'Sprint', 'pt-BR')).toBe('Sprint ignorado: o quadro não existe mais')
        expect(formatBytes(1_572_864, 'pt-BR')).toBe('1,5 MB')
    })

    it('errors', () =>
        expect(errorMessage({ code: 'network.dns', params: { host: 'x.invalid' } }, t)).toContain('"x.invalid"'))
})

describe('formatters (en-US)', () => {
    const t = createI18n('en-US').t
    const dates = new DateFormatter('en-US', t)
    it('recurrence', () =>
        expect(
            describeRecurrence({ freq: 'weekly', interval: 2, byWeekday: [1, 3] }, new Date(2026, 8, 28), t, dates)
        ).toBe('Every 2 weeks: Mon, Wed'))
})
