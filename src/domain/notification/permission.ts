export type NotifyPermission = 'granted' | 'denied' | 'unconfirmed' | 'unsupported'

/** Blocking reason, translated via i18n (`notification.permission.<reason>`). */
export type PermissionReason = 'unsigned' | 'alertsOff' | 'refused' | 'noAnswer' | 'unsupported' | 'notSeen'

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

/**
 * Which copy of the app wrote a record. The dev build and the installed app share the data folder,
 * but for the operating system they are different apps with separate notification settings.
 */
export type AppCopy = 'dev' | 'installed'

/** Last result Electron reported for a notification. */
export interface DeliveryRecord {
    ok: boolean
    at: string
    detail?: string
    app?: AppCopy
}

/** The user's answer to "did the test notification appear?". */
export interface DeliveryConfirmation {
    seen: boolean
    at: string
    app: AppCopy
}

export interface PermissionEvidence {
    supported: boolean
    isMac: boolean
    signed: boolean
    /** macOS Notification Center record (1 = badge, 2 = sound, 4 = alerts), when the app is registered there. */
    notificationCenterAuth?: number
    lastDelivery?: DeliveryRecord
    confirmation?: DeliveryConfirmation
    app: AppCopy
}

export type PermissionVerdict = Pick<NotifyPermissionInfo, 'status' | 'reason' | 'detail'>

const ALERTS_AUTH_BIT = 4

const fromApp = <T extends { app?: AppCopy }>(record: T | undefined, app: AppCopy) =>
    record && record.app === app ? record : undefined

function isNewer(first: { at: string } | undefined, second: { at: string } | undefined): boolean {
    if (!first) return false
    if (!second) return true
    return first.at > second.at
}

/**
 * Whether notifications really reach the screen.
 * Electron reports "shown" even when macOS or Windows silently drops the notification (switched off in the
 * system settings), so a delivery is never proof. The answers are, in order: the system refused it,
 * the app is unsigned (macOS drops everything), what macOS recorded for the app, and the user's own answer after
 * a test. Without any of those, the state is "unconfirmed".
 */
export function resolvePermission(evidence: PermissionEvidence): PermissionVerdict {
    if (!evidence.supported) return { status: 'unsupported', reason: 'unsupported' }
    const confirmation = fromApp(evidence.confirmation, evidence.app)
    const blocked = blockingVerdict(evidence, confirmation)
    if (blocked) return blocked
    return confirmedVerdict(evidence, confirmation)
}

/** Situations where notifications certainly do not appear. */
function blockingVerdict(
    evidence: PermissionEvidence,
    confirmation: DeliveryConfirmation | undefined
): PermissionVerdict | undefined {
    const delivery = fromApp(evidence.lastDelivery, evidence.app)
    const refusedAfterConfirmation = delivery && !delivery.ok && isNewer(delivery, confirmation)
    if (refusedAfterConfirmation) return { status: 'denied', reason: 'refused', detail: delivery.detail }
    if (evidence.isMac && !evidence.signed) return { status: 'denied', reason: 'unsigned' }
    const auth = evidence.notificationCenterAuth
    const alertsOff = auth !== undefined && (auth & ALERTS_AUTH_BIT) === 0
    if (alertsOff) return { status: 'denied', reason: 'alertsOff' }
    return undefined
}

function confirmedVerdict(
    evidence: PermissionEvidence,
    confirmation: DeliveryConfirmation | undefined
): PermissionVerdict {
    if (confirmation && !confirmation.seen) return { status: 'denied', reason: 'notSeen' }
    if (confirmation?.seen) return { status: 'granted' }
    if (evidence.notificationCenterAuth !== undefined) return { status: 'granted' }
    return { status: 'unconfirmed' }
}
