import { describe, expect, it } from 'vitest'
import {
    attachmentKind,
    canOpenInSystem,
    canPreview,
    decodeText,
    looksBinary,
    PREVIEW_MAX_BYTES,
    previewFromBytes,
    findInlineAttachment,
    safeFileName,
    sniffImageType,
    toBase64
} from './attachment-kind'

const file = (filename: string, filesize = 1000, contentType?: string) => ({
    filename,
    filesize,
    content_type: contentType
})

describe('attachmentKind', () => {
    it('trusts the extension first', () => {
        expect(attachmentKind('Tela.PNG', 'application/octet-stream')).toBe('image')
        expect(attachmentKind('erro.log')).toBe('text')
        expect(attachmentKind('contrato.docx')).toBe('document')
        expect(attachmentKind('dump.zip')).toBe('archive')
    })

    it('falls back to the content type for unknown extensions', () => {
        expect(attachmentKind('captura', 'image/png')).toBe('image')
        expect(attachmentKind('dados.unknown', 'application/json')).toBe('text')
        expect(attachmentKind('arquivo.bin', 'application/octet-stream')).toBe('other')
    })
})

describe('canPreview', () => {
    it('shows images Chromium draws and text files within the limit', () => {
        expect(canPreview(file('a.png'))).toBe(true)
        expect(canPreview(file('a.svg'))).toBe(true)
        expect(canPreview(file('a.heic'))).toBe(false)
        expect(canPreview(file('a.json'))).toBe(true)
        expect(canPreview(file('a.pdf'))).toBe(false)
        expect(canPreview(file('a.txt', PREVIEW_MAX_BYTES.text + 1))).toBe(false)
    })
    it('plays the video and audio formats Chromium knows, within the limit', () => {
        expect(canPreview(file('tela.mp4'))).toBe(true)
        expect(canPreview(file('tela.MOV'))).toBe(true)
        expect(canPreview(file('nota.m4a'))).toBe(true)
        expect(canPreview(file('tela.mkv'))).toBe(false)
        expect(canPreview(file('tela.webm', PREVIEW_MAX_BYTES.media + 1))).toBe(false)
    })
})

describe('canOpenInSystem', () => {
    it('opens documents and media', () => {
        expect(canOpenInSystem(file('a.pdf'))).toBe(true)
        expect(canOpenInSystem(file('a.xlsx'))).toBe(true)
        expect(canOpenInSystem(file('a.mp4'))).toBe(true)
    })

    it('never opens what can run code, nor archives', () => {
        for (const name of ['a.exe', 'a.bat', 'a.js', 'a.html', 'a.svg', 'a.xlsm', 'a.command', 'a.zip', 'a.bin']) {
            expect(canOpenInSystem(file(name))).toBe(false)
        }
    })
})

describe('sniffImageType', () => {
    it('reads the type from the first bytes', () => {
        expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe('image/png')
        expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
        expect(sniffImageType(new TextEncoder().encode('  <svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(
            'image/svg+xml'
        )
    })

    it('rejects bytes that are not an image', () => {
        expect(sniffImageType(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeUndefined()
    })
})

describe('text helpers', () => {
    it('spots binary files by a NUL byte', () => {
        expect(looksBinary(new Uint8Array([0x50, 0x4b, 0x00, 0x01]))).toBe(true)
        expect(looksBinary(new TextEncoder().encode('linha 1\nlinha 2'))).toBe(false)
    })

    it('decodes UTF-8 and falls back to Windows-1252', () => {
        expect(decodeText(new TextEncoder().encode('ação'))).toBe('ação')
        expect(decodeText(new Uint8Array([0x61, 0xe7, 0xe3, 0x6f]))).toBe('ação')
    })

    it('encodes base64 in chunks', () => {
        expect(toBase64(new TextEncoder().encode('Redmine'))).toBe('UmVkbWluZQ==')
    })
})

describe('safeFileName', () => {
    it('drops folders and reserved characters', () => {
        expect(safeFileName('../../etc/passwd')).toBe('passwd')
        expect(safeFileName('C:\\temp\\rel:at?rio*.pdf')).toBe('rel_at_rio_.pdf')
        expect(safeFileName('...')).toBe('attachment')
    })

    it('keeps the extension when shortening', () => {
        const shortened = safeFileName(`${'a'.repeat(300)}.pdf`)
        expect(shortened).toHaveLength(120)
        expect(shortened.endsWith('.pdf')).toBe(true)
    })
})

describe('previewFromBytes', () => {
    it('draws images by their real type, shows text and refuses binaries named as text', () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2])
        expect(previewFromBytes({ filename: 'tela.jpg' }, png)).toEqual({
            kind: 'image',
            dataUrl: `data:image/png;base64,${toBase64(png)}`
        })
        const log = new TextEncoder().encode('erro 500')
        expect(previewFromBytes({ filename: 'console.log' }, log)).toMatchObject({ kind: 'text', text: 'erro 500' })
        expect(previewFromBytes({ filename: 'dump.log' }, new Uint8Array([65, 0, 66]))).toBeUndefined()
        expect(previewFromBytes({ filename: 'manual.pdf' }, log)).toBeUndefined()
    })
})

describe('previewFromBytes with media', () => {
    it('hands the bytes to the player with the container type', () => {
        const bytes = new Uint8Array([1, 2, 3])
        expect(previewFromBytes({ filename: 'tela.mov' }, bytes)).toEqual({
            kind: 'video',
            mimeType: 'video/mp4',
            bytes
        })
        expect(previewFromBytes({ filename: 'nota.mp3' }, bytes)).toMatchObject({
            kind: 'audio',
            mimeType: 'audio/mpeg'
        })
        expect(previewFromBytes({ filename: 'tela.avi' }, bytes)).toBeUndefined()
    })
})

describe('findInlineAttachment', () => {
    const attachments = [
        { id: 1, filename: 'Print.png' },
        { id: 2, filename: 'tela inicial.png' },
        { id: 3, filename: 'print.png' }
    ]
    it('a relative source is the attachment with that name, the newest when repeated', () => {
        expect(findInlineAttachment('print.png', attachments)?.id).toBe(3)
        expect(findInlineAttachment('tela%20inicial.png', attachments)?.id).toBe(2)
        expect(findInlineAttachment('outra.png', attachments)).toBeUndefined()
    })
    it('Redmine attachment links are matched by id', () => {
        expect(findInlineAttachment('https://redmine.example/attachments/download/2/x.png', attachments)?.id).toBe(2)
        expect(findInlineAttachment('/attachments/1', attachments)?.id).toBe(1)
    })
    it('images on other sites are left alone', () => {
        expect(findInlineAttachment('https://example.com/print.png', attachments)).toBeUndefined()
    })
})
