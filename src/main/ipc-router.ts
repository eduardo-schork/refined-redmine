import { ipcMain } from 'electron'
import { API_METHODS, channel, type IpcResult, type RefinedApi } from '@contracts/api'
import { serializeError } from '@domain/shared/errors'

type Handler = (...args: never[]) => unknown
type HandlerTable = Record<string, Record<string, Handler>>

type MaybeAsync<Method> = Method extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result | Promise<Result>
    : never

/** Each method may be synchronous or asynchronous. */
export type ApiHandlers = {
    [Group in keyof RefinedApi]: {
        [Method in keyof RefinedApi[Group]]: MaybeAsync<RefinedApi[Group][Method]>
    }
}

async function invokeHandler(handler: Handler, label: string, args: unknown[]): Promise<IpcResult<unknown>> {
    try {
        const data = await handler(...(args as never[]))
        return { ok: true, data }
    } catch (thrown) {
        const error = serializeError(thrown)
        if (error.code === 'unexpected') console.error(`[ipc] ${label}`, thrown)
        return { ok: false, error }
    }
}

/** Registers one IPC channel per method and wraps the result in IpcResult. */
export function registerApi(handlers: ApiHandlers): void {
    const handlerTable = handlers as unknown as HandlerTable
    for (const [group, methods] of Object.entries(API_METHODS)) {
        for (const method of methods) {
            const handler = handlerTable[group][method]
            const label = `${group}.${method}`
            ipcMain.handle(channel(group, method), (_event, ...args) => invokeHandler(handler, label, args))
        }
    }
}
