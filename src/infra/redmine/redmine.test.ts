import { describe, expect, it } from 'vitest'
import { AppError } from '@domain/shared/errors'
import { httpError, networkErrorCode, RedmineHttpClient } from './http-client'
import { HttpRedmineGateway, issueParams } from './http-redmine-gateway'

const credentials = () => ({ baseUrl: 'https://r.test/', apiKey: 'k' })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('issueParams', () => {
    it('translates the specification', () => {
        expect(issueParams({ assignedTo: 'me', status: [1, 2], sort: 'priority' })).toMatchObject({
            assigned_to_id: 'me',
            status_id: '1|2',
            sort: 'priority:desc,updated_on:desc'
        })
        expect(issueParams({ project: { id: 10, includeSubprojects: false } })).toMatchObject({
            project_id: 10,
            subproject_id: '!*'
        })
        expect(issueParams({ queryId: 5, queryProjectId: 10, assignedTo: 'me' })).toEqual({
            query_id: 5,
            project_id: 10
        })
        expect(issueParams({ updatedSince: '2026-09-28T10:00:00Z' }).updated_on).toBe('>=2026-09-28T10:00:00Z')
    })
})

describe('RedmineHttpClient', () => {
    it('sends the API key and builds the URL', async () => {
        const calls: [string, RequestInit][] = []
        const recordingFetch = async (url: string, init: RequestInit) => {
            calls.push([url, init])
            return json({ ok: 1 })
        }
        const client = new RedmineHttpClient(recordingFetch, credentials)
        await client.request('GET', '/issues.json', { params: { a: 1, b: undefined } })
        expect(calls[0][0]).toBe('https://r.test/issues.json?a=1')
        expect((calls[0][1].headers as Record<string, string>)['X-Redmine-API-Key']).toBe('k')
    })

    it('retries on a 5xx GET error', async () => {
        let callCount = 0
        const client = new RedmineHttpClient(
            async () => {
                callCount += 1
                return callCount < 3 ? json({}, 502) : json({ ok: 1 })
            },
            credentials,
            async () => {}
        )
        await expect(client.request('GET', '/x')).resolves.toEqual({ ok: 1 })
        expect(callCount).toBe(3)
    })

    it('translates errors', async () => {
        const client = new RedmineHttpClient(
            async () => json({ errors: ['Status inválido'] }, 422),
            credentials,
            async () => {}
        )
        await expect(client.request('PUT', '/x')).rejects.toMatchObject({
            code: 'redmine.rejected',
            params: { detail: 'Status inválido' }
        })
        expect(httpError(401, '').code).toBe('redmine.unauthorized')
        expect(networkErrorCode('net::ERR_NAME_NOT_RESOLVED')).toBe('network.dns')
        await expect(
            new RedmineHttpClient(
                async () => json({}),
                () => null
            ).request('GET', '/x')
        ).rejects.toBeInstanceOf(AppError)
    })
})

describe('HttpRedmineGateway', () => {
    it('paginates up to the total', async () => {
        const pages = [
            { issues: Array.from({ length: 100 }, (_, index) => ({ id: index })), total_count: 150 },
            { issues: Array.from({ length: 50 }, (_, index) => ({ id: 100 + index })), total_count: 150 }
        ]
        let requestCount = 0
        const nextPage = async () => {
            const response = json(pages[requestCount])
            requestCount += 1
            return response
        }
        const gateway = new HttpRedmineGateway(new RedmineHttpClient(nextPage, credentials))
        const page = await gateway.listIssues({ status: 'open' }, 500)
        expect([page.items.length, page.total, requestCount]).toEqual([150, 150, 2])
    })
})

describe('HttpRedmineGateway.updateIssue', () => {
    it('clears fields with an empty string and leaves untouched ones out of the body', async () => {
        const bodies: unknown[] = []
        const client = new RedmineHttpClient(async (_url, init) => {
            bodies.push(JSON.parse(String(init.body)))
            return new Response(null, { status: 204 })
        }, credentials)
        await new HttpRedmineGateway(client).updateIssue(5, { assignedToId: null, dueDate: null, doneRatio: 30 })
        expect(bodies[0]).toEqual({ issue: { assigned_to_id: '', due_date: '', done_ratio: 30 } })
    })

    it('never sends a pasted key with invalid characters: the network error is scrubbed of it', async () => {
        const client = new RedmineHttpClient(
            async () => {
                throw new TypeError('Invalid header value "bad key"')
            },
            () => ({ baseUrl: 'https://r.test/', apiKey: 'bad key' }),
            async () => {}
        )
        await expect(client.request('GET', '/x.json')).rejects.toMatchObject({
            params: { detail: expect.not.stringContaining('bad key') }
        })
    })
})
