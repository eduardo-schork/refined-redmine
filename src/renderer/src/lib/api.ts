import { API_METHODS, type AppEvents, type RefinedApi } from '@contracts/api'
import { AppError } from '@domain/shared/errors'

type Async<T> = {
    [Group in keyof T]: {
        [Method in keyof T[Group]]: T[Group][Method] extends (...args: infer Args) => infer Result
            ? (...args: Args) => Promise<Awaited<Result>>
            : never
    }
}

type AsyncMethod = (...args: unknown[]) => Promise<unknown>
type MethodGroups = Record<string, Record<string, AsyncMethod>>

type IpcResult =
    | { ok: true; data: unknown }
    | { ok: false; error: { code: AppError['code']; params: AppError['params']; status?: number } }

// Unwraps the IpcResult and rethrows failures as AppError, so the UI can translate them via i18n.
function createMethod(group: string, method: string): AsyncMethod {
    return async (...args) => {
        const bridge = window.bridge as unknown as MethodGroups
        const result = (await bridge[group][method](...args)) as IpcResult
        if (!result.ok) {
            const { code, params, status } = result.error
            throw new AppError(code, params, status)
        }
        return result.data
    }
}

function createClient(): Async<RefinedApi> {
    const client: MethodGroups = {}
    for (const [group, methods] of Object.entries(API_METHODS)) {
        client[group] = {}
        for (const method of methods) {
            client[group][method] = createMethod(group, method)
        }
    }
    return client as Async<RefinedApi>
}

export const api = createClient()

export function onAppEvent<EventName extends keyof AppEvents>(
    event: EventName,
    listener: (payload: AppEvents[EventName]) => void
): () => void {
    return window.bridge.on(event, listener)
}
