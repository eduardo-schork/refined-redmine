import { describe, expect, it } from 'vitest'
import { assertValidUploads, cleanUpload, MAX_UPLOAD_BYTES, MAX_UPLOADS } from './issue-upload'

const file = (filename: string, size = 3) => ({ filename, bytes: new Uint8Array(size) })

describe('assertValidUploads', () => {
    it('refuses too many files and files too large to send, naming the file', () => {
        const many = Array.from({ length: MAX_UPLOADS + 1 }, (_, index) => file(`print-${index}.png`))
        expect(() => assertValidUploads(many)).toThrow('issue.tooManyUploads')
        expect(() => assertValidUploads([file('video.mp4', MAX_UPLOAD_BYTES + 1)])).toThrow('issue.uploadTooLarge')
        expect(() => assertValidUploads([file('print.png')])).not.toThrow()
    })
})

describe('cleanUpload', () => {
    it('keeps only the name of the file and a well-formed type', () => {
        const cleaned = cleanUpload({ ...file('../../etc/passwd'), contentType: 'text/plain; x' })
        expect(cleaned).toMatchObject({ filename: 'passwd', contentType: undefined })
        expect(cleanUpload({ ...file('C:\\prints\\tela.png'), contentType: 'image/png' })).toMatchObject({
            filename: 'tela.png',
            contentType: 'image/png'
        })
        expect(cleanUpload(file('  ')).filename).toBe('file')
    })
})
