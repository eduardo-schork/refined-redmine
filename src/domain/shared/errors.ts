/** The user-facing message is built from the code via i18n (`errors.<code>`). */
export type ErrorCode =
    | 'redmine.notConfigured'
    | 'redmine.unauthorized'
    | 'redmine.forbidden'
    | 'redmine.notFound'
    | 'redmine.rejected'
    | 'redmine.http'
    | 'redmine.invalidResponse'
    | 'network.dns'
    | 'network.refused'
    | 'network.tls'
    | 'network.unreachable'
    | 'network.reset'
    | 'network.proxy'
    | 'network.timeout'
    | 'network.unknown'
    | 'auth.invalidUrl'
    | 'auth.invalidKey'
    | 'workflow.transitionNotAllowed'
    | 'board.nameRequired'
    | 'board.projectRequired'
    | 'board.queryRequired'
    | 'board.sprintRequired'
    | 'board.columnsRequired'
    | 'board.filterRequired'
    | 'filter.invalidUrl'
    | 'monitor.nameRequired'
    | 'monitor.sourceRequired'
    | 'update.unauthorized'
    | 'update.notFound'
    | 'update.noInstaller'
    | 'update.http'
    | 'update.untrusted'
    | 'calendar.titleRequired'
    | 'calendar.invalidIssue'
    | 'unexpected'

export type ErrorParams = Record<string, string | number>

export class AppError extends Error {
    constructor(
        readonly code: ErrorCode,
        readonly params: ErrorParams = {},
        readonly status?: number
    ) {
        super(code)
        this.name = 'AppError'
    }
}

/** Serializable form: an Error instance loses its fields when crossing IPC. */
export interface SerializedError {
    code: ErrorCode
    params: ErrorParams
    status?: number
}

export function serializeError(error: unknown): SerializedError {
    if (error instanceof AppError) return { code: error.code, params: error.params, status: error.status }
    const detail = error instanceof Error ? error.message : String(error)
    return { code: 'unexpected', params: { detail } }
}
