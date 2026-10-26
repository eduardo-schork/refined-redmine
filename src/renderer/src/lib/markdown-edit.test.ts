import { describe, expect, it } from 'vitest'
import { codeBlock, insertText, prefixLines, wrapSelection } from './markdown-edit'

describe('markdown editing', () => {
    it('wraps the selection and keeps it selected', () => {
        expect(wrapSelection({ text: 'say hello now', start: 4, end: 9 }, '**')).toEqual({
            text: 'say **hello** now',
            start: 6,
            end: 11
        })
    })

    it('puts the cursor between the marks when nothing is selected', () => {
        expect(wrapSelection({ text: 'ab', start: 1, end: 1 }, '`')).toEqual({ text: 'a``b', start: 2, end: 2 })
    })

    it('prefixes every selected line, from the start of the first one', () => {
        const result = prefixLines({ text: 'one\ntwo\nthree', start: 1, end: 7 }, (index) => `${index + 1}. `)
        expect(result.text).toBe('1. one\n2. two\nthree')
        expect(result.text.slice(result.start, result.end)).toBe('ne\n2. two')
    })

    it('puts a code block on lines of its own', () => {
        expect(codeBlock({ text: 'see x', start: 4, end: 5 }).text).toBe('see \n```\nx\n```\n')
    })

    it('inserts at the cursor', () => {
        expect(insertText({ text: 'ab', start: 1, end: 1 }, '![](print.png)')).toEqual({
            text: 'a![](print.png)b',
            start: 15,
            end: 15
        })
    })
})
