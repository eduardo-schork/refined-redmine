import type { Bridge } from '../contracts/api'

declare global {
    interface Window {
        bridge: Bridge
    }
}

export {}
