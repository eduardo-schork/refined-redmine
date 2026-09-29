export type NotifyPermission = 'granted' | 'denied' | 'not-determined' | 'unsupported'

/** Blocking reason, translated via i18n (`notification.permission.<reason>`). */
export type PermissionReason = 'unsigned' | 'alertsOff' | 'refused' | 'noAnswer' | 'unsupported'

export interface NotifyPermissionInfo {
    status: NotifyPermission
    reason?: PermissionReason
    /** Raw message from the operating system, when available. */
    detail?: string
    bundleId?: string
    signed: boolean
    dev: boolean
}

export interface NotifyProbeResult {
    shown: boolean
    reason?: PermissionReason
    detail?: string
}

/** Last actual delivery result of a notification (the most reliable signal on macOS). */
export interface DeliveryRecord {
    ok: boolean
    at: string
    detail?: string
}
