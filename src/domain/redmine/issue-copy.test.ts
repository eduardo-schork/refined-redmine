import { describe, expect, it } from 'vitest'
import { copyText } from './issue-copy'

const issue = { id: 1234, subject: ' Ajustar [layout] do preço ' }
const url = 'https://redmine.example.com/issues/1234'

describe('copyText', () => {
    it('formats each kind of copy', () => {
        expect(copyText('link', issue, url)).toBe(url)
        expect(copyText('number', issue, url)).toBe('#1234')
        expect(copyText('title', issue, url)).toBe('Ajustar [layout] do preço')
        expect(copyText('reference', issue, url)).toBe('#1234 Ajustar [layout] do preço')
    })

    it('escapes brackets in the Markdown link text', () => {
        expect(copyText('markdown', issue, url)).toBe(`[#1234 Ajustar \\[layout\\] do preço](${url})`)
    })
})
