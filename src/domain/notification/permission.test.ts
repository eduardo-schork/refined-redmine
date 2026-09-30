import { describe, expect, it } from 'vitest'
import { resolvePermission, type PermissionEvidence } from './permission'

const base: PermissionEvidence = { supported: true, isMac: true, signed: true, app: 'installed' }
const at = (minute: number) => `2026-09-29T10:${String(minute).padStart(2, '0')}:00.000Z`

describe('resolvePermission', () => {
    it('a delivery reported by Electron is not enough: it stays unconfirmed', () =>
        expect(resolvePermission({ ...base, lastDelivery: { ok: true, at: at(1), app: 'installed' } })).toEqual({
            status: 'unconfirmed'
        }))
    it('only the user answer confirms it', () => {
        const seen = { seen: true, at: at(2), app: 'installed' as const }
        const notSeen = { ...seen, seen: false }
        expect(resolvePermission({ ...base, confirmation: seen }).status).toBe('granted')
        expect(resolvePermission({ ...base, confirmation: notSeen })).toEqual({ status: 'denied', reason: 'notSeen' })
    })
    it('the dev build answer does not count for the installed app', () =>
        expect(resolvePermission({ ...base, confirmation: { seen: true, at: at(2), app: 'dev' } }).status).toBe(
            'unconfirmed'
        ))
    it('macOS records win over a missing answer', () => {
        expect(resolvePermission({ ...base, notificationCenterAuth: 7 }).status).toBe('granted')
        expect(resolvePermission({ ...base, notificationCenterAuth: 3 })).toEqual({
            status: 'denied',
            reason: 'alertsOff'
        })
    })
    it('a refusal newer than the answer blocks again', () => {
        const confirmation = { seen: true, at: at(1), app: 'installed' as const }
        const lastDelivery = { ok: false, at: at(5), app: 'installed' as const, detail: 'denied' }
        expect(resolvePermission({ ...base, confirmation, lastDelivery })).toMatchObject({ reason: 'refused' })
    })
    it('unsigned macOS apps never show notifications', () =>
        expect(resolvePermission({ ...base, signed: false }).reason).toBe('unsigned'))
})
