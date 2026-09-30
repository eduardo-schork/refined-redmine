import { normalizeBaseUrl } from '@domain/redmine/links'
import { AppError, type ErrorCode } from '@domain/shared/errors'
import { redactSecret } from '@domain/shared/secrets'
import type { RedmineCredentials } from '@application/ports/redmine-gateway'

export type Fetch = (url: string, init: RequestInit) => Promise<Response>
export type Params = Record<string, string | number | undefined>

type HttpMethod = 'GET' | 'PUT' | 'POST' | 'DELETE'

interface RequestOptions {
    params?: Params
    /** Query string copied from a Redmine page; `params` are applied on top of it. */
    rawQuery?: string
    body?: unknown
    credentials?: RedmineCredentials
}

/** What happened in one attempt of a request (for the activity log). */
export interface RequestRecord {
    method: HttpMethod
    url: string
    status?: number
    durationMs: number
    bytes: number
    attempt: number
    errorCode?: ErrorCode
}

export type RequestObserver = (record: RequestRecord) => void

type AttemptOutcome<T> = { succeeded: true; value: T } | { succeeded: false; error: AppError; canRetry: boolean }

interface AttemptRequest {
    url: URL
    method: HttpMethod
    apiKey: string
    body: unknown
    attempt: number
}

const TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 400

/** Order matters: the first matching pattern wins. */
const NETWORK_ERROR_PATTERNS: [RegExp, ErrorCode][] = [
    [/name_not_resolved|enotfound|getaddrinfo/, 'network.dns'],
    [/connection_refused|econnrefused/, 'network.refused'],
    [/cert|ssl|tls|handshake/, 'network.tls'],
    [/unreachable|address_unreachable|internet_disconnected/, 'network.unreachable'],
    [/connection_reset|econnreset|connection_closed/, 'network.reset'],
    [/proxy/, 'network.proxy'],
    [/abort|timeout|timed_out/, 'network.timeout']
]

const HTTP_STATUS_ERROR_CODES: Partial<Record<number, ErrorCode>> = {
    401: 'redmine.unauthorized',
    403: 'redmine.forbidden',
    404: 'redmine.notFound'
}

/** Translates a Chromium/Node network failure into an error code (based on redmine-adapter). */
export function networkErrorCode(message: string): ErrorCode {
    const lowerMessage = message.toLowerCase()
    const match = NETWORK_ERROR_PATTERNS.find(([pattern]) => pattern.test(lowerMessage))
    return match ? match[1] : 'network.unknown'
}

/** Redmine explains validation failures in `{ "errors": [...] }`; the body may also be HTML or empty. */
function redmineErrorMessages(body: string): string[] {
    try {
        const json = JSON.parse(body)
        return Array.isArray(json.errors) ? json.errors : []
    } catch {
        return []
    }
}

export function httpError(status: number, body: string): AppError {
    const errors = redmineErrorMessages(body)
    if (errors.length) return new AppError('redmine.rejected', { detail: errors.join('; ') }, status)

    const code = HTTP_STATUS_ERROR_CODES[status]
    if (code) return new AppError(code, {}, status)
    if (status === 422) return new AppError('redmine.rejected', { detail: '' }, status)
    return new AppError('redmine.http', { status }, status)
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorMessage(error: unknown): string {
    return String((error as Error)?.message ?? error)
}

function buildUrl(baseUrl: string, path: string, params: Params = {}, rawQuery = ''): URL {
    const relativePath = path.replace(/^\/+/, '')
    const url = new URL(`${normalizeBaseUrl(baseUrl)}/${relativePath}`)
    url.search = rawQuery
    for (const [name, value] of Object.entries(params)) {
        const hasValue = value !== undefined && value !== ''
        if (hasValue) url.searchParams.set(name, String(value))
    }
    return url
}

function parseBody<T>(text: string): T {
    if (!text) return null as T
    return JSON.parse(text) as T
}

/** HTTP client for the Redmine REST API: API key authentication, timeout, retries on GET. */
export class RedmineHttpClient {
    constructor(
        private readonly fetch: Fetch,
        private readonly credentials: () => RedmineCredentials | null,
        private readonly wait: (ms: number) => Promise<void> = sleep,
        private readonly observe: RequestObserver = () => {}
    ) {}

    async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
        const credentials = options.credentials ?? this.credentials()
        if (!credentials?.baseUrl || !credentials.apiKey) throw new AppError('redmine.notConfigured')

        const url = buildUrl(credentials.baseUrl, path, options.params, options.rawQuery)
        const maxAttempts = method === 'GET' ? MAX_ATTEMPTS : 1
        let lastError: AppError | undefined

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const request = { url, method, apiKey: credentials.apiKey, body: options.body, attempt }
            const outcome = await this.attempt<T>(request)
            if (outcome.succeeded) return outcome.value

            lastError = outcome.error
            if (!outcome.canRetry) break
            if (attempt < maxAttempts) await this.wait(RETRY_BASE_DELAY_MS * attempt)
        }
        throw lastError ?? new AppError('network.unknown', { host: url.host, detail: '' })
    }

    /** Client errors (4xx) are final; server errors (5xx) and network failures may be retried. */
    private async attempt<T>(request: AttemptRequest): Promise<AttemptOutcome<T>> {
        const startedAt = Date.now()
        const record = (fields: Pick<RequestRecord, 'status' | 'bytes' | 'errorCode'>) => {
            const url = `${request.url.pathname}${request.url.search}`
            const durationMs = Date.now() - startedAt
            this.observe({ method: request.method, url, durationMs, attempt: request.attempt, ...fields })
        }
        try {
            const response = await this.fetch(request.url.toString(), {
                method: request.method,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Redmine-API-Key': request.apiKey
                },
                body: request.body === undefined ? undefined : JSON.stringify(request.body),
                signal: AbortSignal.timeout(TIMEOUT_MS)
            })
            const text = await response.text()
            const bytes = new TextEncoder().encode(text).length
            if (response.ok) {
                record({ status: response.status, bytes })
                return { succeeded: true, value: parseBody<T>(text) }
            }

            const error = httpError(response.status, text)
            record({ status: response.status, bytes, errorCode: error.code })
            const canRetry = response.status >= 500
            return { succeeded: false, error, canRetry }
        } catch (error) {
            if (error instanceof SyntaxError) {
                record({ bytes: 0, errorCode: 'redmine.invalidResponse' })
                throw new AppError('redmine.invalidResponse')
            }
            const detail = redactSecret(errorMessage(error), request.apiKey)
            const networkError = new AppError(networkErrorCode(detail), { host: request.url.host, detail })
            record({ bytes: 0, errorCode: networkError.code })
            return { succeeded: false, error: networkError, canRetry: true }
        }
    }
}
