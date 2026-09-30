import { describe, expect, it } from 'vitest'
import { isWellFormedSecret, redactSecret } from './secrets'

describe('secrets', () => {
    it('accepts Redmine keys and GitHub tokens, refuses pasted spaces and line breaks', () => {
        expect(isWellFormedSecret('0123456789abcdef0123456789abcdef01234567')).toBe(true)
        expect(isWellFormedSecret('ghp_AbC123')).toBe(true)
        expect(isWellFormedSecret('ghp_AbC123\n')).toBe(false)
        expect(isWellFormedSecret('abc def')).toBe(false)
    })
    it('removes the secret from messages', () =>
        expect(redactSecret('invalid header value "Bearer ghp_x1"', 'ghp_x1')).toBe(
            'invalid header value "Bearer •••"'
        ))
})
