import type { SerializedError } from '@domain/shared/errors'
import type { TFunction } from 'i18next'

/** Error message in the current language. */
export function errorMessage(err: SerializedError, t: TFunction): string {
    const params = { detail: '', host: '', status: '', column: '', ...err.params }
    return t(`errors.${err.code}`, params)
}
