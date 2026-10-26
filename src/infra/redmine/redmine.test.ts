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

    it('tries once when asked not to retry (connection screen)', async () => {
        let callCount = 0
        const client = new RedmineHttpClient(
            async () => {
                callCount += 1
                return json({}, 502)
            },
            credentials,
            async () => {}
        )
        await expect(client.request('GET', '/my/account.json', { noRetry: true })).rejects.toMatchObject({
            code: 'redmine.http'
        })
        expect(callCount).toBe(1)
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
        // An invalid key stays an invalid key even when the answer also carries an "errors" body.
        expect(httpError(401, '{"errors":["Invalid API key"]}').code).toBe('redmine.unauthorized')
        expect(httpError(422, '{"errors":["Subject cannot be blank"]}').code).toBe('redmine.rejected')
        expect(networkErrorCode('net::ERR_NAME_NOT_RESOLVED')).toBe('network.dns')
        await expect(
            new RedmineHttpClient(
                async () => json({}),
                () => null
            ).request('GET', '/x')
        ).rejects.toBeInstanceOf(AppError)
    })
})

describe('RedmineHttpClient.download', () => {
    it('returns the bytes and refuses redirects, which could carry the key to another host', async () => {
        const calls: RequestInit[] = []
        const client = new RedmineHttpClient(async (_url, init) => {
            calls.push(init)
            return new Response(new Uint8Array([1, 2, 3]))
        }, credentials)

        const bytes = await client.download('/attachments/download/7', 10)

        expect([...bytes]).toEqual([1, 2, 3])
        expect(calls[0].redirect).toBe('error')
    })

    it('refuses files larger than the limit, by header or by body, without retrying', async () => {
        let callCount = 0
        const declared = new RedmineHttpClient(async () => {
            callCount += 1
            return new Response('x', { headers: { 'content-length': '999' } })
        }, credentials)
        const actual = new RedmineHttpClient(async () => new Response(new Uint8Array(20)), credentials)

        await expect(declared.download('/attachments/download/7', 10)).rejects.toMatchObject({
            code: 'attachment.tooLarge'
        })
        await expect(actual.download('/attachments/download/7', 10)).rejects.toMatchObject({
            code: 'attachment.tooLarge'
        })
        expect(callCount).toBe(1)
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

describe('HttpRedmineGateway.listTimeEntries', () => {
    it('asks one more day on each side (Redmine shifts the period by time zone) and keeps only the period', async () => {
        const urls: string[] = []
        const day = (spentOn: string) => ({ id: spentOn.length, spent_on: spentOn, hours: 1 })
        const client = new RedmineHttpClient(async (url) => {
            urls.push(String(url))
            const entries = [day('2026-10-18'), day('2026-10-19'), day('2026-10-25'), day('2026-10-26')]
            return json({ time_entries: entries, total_count: 4 })
        }, credentials)
        const entries = await new HttpRedmineGateway(client).listTimeEntries({ from: '2026-10-19', to: '2026-10-25' })

        expect(urls[0]).toContain('from=2026-10-18')
        expect(urls[0]).toContain('to=2026-10-26')
        expect(entries.map((entry) => entry.spent_on)).toEqual(['2026-10-19', '2026-10-25'])
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

    it('creates an issue with POST, leaving the fields not chosen out of the body', async () => {
        const requests: { url: string; method?: string; body: unknown }[] = []
        const client = new RedmineHttpClient(async (url, init) => {
            requests.push({ url: String(url), method: init.method, body: JSON.parse(String(init.body)) })
            return json({ issue: { id: 1300, subject: 'Cupom duplicado' } })
        }, credentials)
        const created = await new HttpRedmineGateway(client).createIssue({
            projectId: 10,
            trackerId: 2,
            subject: 'Cupom duplicado',
            fixedVersionId: 378
        })
        expect(created.id).toBe(1300)
        expect(requests[0]).toMatchObject({ method: 'POST', url: expect.stringContaining('/issues.json') })
        expect(requests[0].body).toEqual({
            issue: { project_id: 10, tracker_id: 2, subject: 'Cupom duplicado', fixed_version_id: 378 }
        })
    })

    it('sends a file as raw bytes and attaches it to the new issue by its token', async () => {
        const requests: { url: string; contentType: string; body: unknown }[] = []
        const client = new RedmineHttpClient(async (url, init) => {
            const headers = init.headers as Record<string, string>
            requests.push({ url: String(url), contentType: headers['Content-Type'], body: init.body })
            if (String(url).includes('/uploads.json')) return json({ upload: { id: 7, token: '7.abc' } })
            return json({ issue: { id: 1301 } })
        }, credentials)
        const gateway = new HttpRedmineGateway(client)
        const bytes = new Uint8Array([137, 80, 78, 71])
        const uploaded = await gateway.uploadFile({ filename: 'tela.png', contentType: 'image/png', bytes })
        await gateway.createIssue({ projectId: 10, subject: 'Bug' }, [uploaded])

        expect(requests[0]).toMatchObject({ contentType: 'application/octet-stream', body: bytes })
        expect(requests[0].url).toContain('/uploads.json?filename=tela.png')
        expect(JSON.parse(String(requests[1].body)).issue.uploads).toEqual([
            { token: '7.abc', filename: 'tela.png', content_type: 'image/png' }
        ])
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
