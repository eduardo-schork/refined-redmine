import { describe, expect, it } from 'vitest'
import type { Attachment } from '@domain/redmine/entities'
import { FakeGateway } from './testing/fakes'
import type { FileOpener } from './ports/system'
import { AttachmentUseCases } from './use-cases/attachments'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const attachment = (id: number, filename: string, filesize = 100): Attachment => ({
    id,
    filename,
    filesize,
    author: { id: 1, name: 'Lucas' },
    created_on: '2026-09-30T10:00:00Z'
})

function setup(files: [Attachment, Uint8Array][]) {
    const gateway = new FakeGateway()
    for (const [file, bytes] of files) gateway.attachments.set(file.id, { attachment: file, bytes })
    const opened: { fileName: string; bytes: Uint8Array }[] = []
    const opener: FileOpener = {
        async open(fileName, bytes) {
            opened.push({ fileName, bytes })
        }
    }
    return { gateway, opened, attachments: new AttachmentUseCases(gateway, opener) }
}

describe('AttachmentUseCases.preview', () => {
    it('sends an image as a data URL typed by its bytes', async () => {
        const { attachments } = setup([[attachment(1, 'tela.jpg'), PNG]])

        const preview = await attachments.preview(1)

        expect(preview).toMatchObject({ kind: 'image' })
        expect(preview.kind === 'image' && preview.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    })

    it('refuses an "image" whose bytes are something else', async () => {
        const page = new TextEncoder().encode('<html><script>alert(1)</script></html>')
        const { attachments } = setup([[attachment(1, 'foto.png'), page]])

        await expect(attachments.preview(1)).rejects.toMatchObject({ code: 'attachment.notPreviewable' })
    })

    it('decodes text files and refuses binary content', async () => {
        const { attachments } = setup([
            [attachment(1, 'erro.log'), new TextEncoder().encode('linha 1\nação')],
            [attachment(2, 'dados.txt'), new Uint8Array([0x50, 0x4b, 0x00, 0x03])]
        ])

        await expect(attachments.preview(1)).resolves.toEqual({
            kind: 'text',
            text: 'linha 1\nação',
            truncated: false,
            extension: 'log'
        })
        await expect(attachments.preview(2)).rejects.toMatchObject({ code: 'attachment.notPreviewable' })
    })

    it('does not download what cannot be previewed', async () => {
        const { attachments, gateway } = setup([[attachment(1, 'contrato.pdf'), PNG]])

        await expect(attachments.preview(1)).rejects.toMatchObject({ code: 'attachment.notPreviewable' })
        expect(gateway.downloads).toEqual([])
    })
})

describe('AttachmentUseCases.open', () => {
    it('hands documents to the system app under a safe name', async () => {
        const { attachments, opened } = setup([[attachment(1, '../relatório.pdf'), PNG]])

        await attachments.open(1)

        expect(opened.map((file) => file.fileName)).toEqual(['relatório.pdf'])
    })

    it('never downloads or opens files that can run code', async () => {
        const { attachments, opened, gateway } = setup([[attachment(1, 'instalar.exe'), PNG]])

        await expect(attachments.open(1)).rejects.toMatchObject({ code: 'attachment.blockedType' })
        expect(gateway.downloads).toEqual([])
        expect(opened).toEqual([])
    })
})
