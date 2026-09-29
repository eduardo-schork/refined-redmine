import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { API_METHODS, channel, EVENT_CHANNELS, type AppEvents, type Bridge } from '@contracts/api'

// With contextIsolation, only the contract channels (generated from API_METHODS) are exposed.
const bridge: Record<string, unknown> = {}
for (const [group, methods] of Object.entries(API_METHODS)) {
    const invokers = methods.map((method) => {
        const invoke = (...args: unknown[]) => ipcRenderer.invoke(channel(group, method), ...args)
        return [method, invoke]
    })
    bridge[group] = Object.fromEntries(invokers)
}

bridge.on = <Event extends keyof AppEvents>(event: Event, listener: (payload: AppEvents[Event]) => void) => {
    const isKnownEvent = (EVENT_CHANNELS as readonly string[]).includes(event)
    if (!isKnownEvent) throw new Error(`Unknown event: ${event}`)
    const handler = (_event: IpcRendererEvent, payload: AppEvents[Event]) => listener(payload)
    ipcRenderer.on(event, handler)
    return () => ipcRenderer.removeListener(event, handler)
}

contextBridge.exposeInMainWorld('bridge', bridge as Bridge)
