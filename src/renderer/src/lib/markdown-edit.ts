/** Text of a Markdown field and what is selected in it. */
export interface TextSelection {
    text: string
    start: number
    end: number
}

/** `**bold**`, `*italic*`…: wraps the selection (or puts the cursor between the marks when nothing is selected). */
export function wrapSelection({ text, start, end }: TextSelection, before: string, after = before): TextSelection {
    const selected = text.slice(start, end)
    const wrapped = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`
    return { text: wrapped, start: start + before.length, end: end + before.length }
}

/** `- `, `1. `, `> `, `## `: added to the start of every selected line. */
export function prefixLines({ text, start, end }: TextSelection, prefix: (lineIndex: number) => string): TextSelection {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const lines = text.slice(lineStart, end).split('\n')
    const prefixed = lines.map((line, index) => `${prefix(index)}${line}`).join('\n')
    const added = prefixed.length - (end - lineStart)
    return {
        text: `${text.slice(0, lineStart)}${prefixed}${text.slice(end)}`,
        start: start + prefix(0).length,
        end: end + added
    }
}

/** A fenced code block around the selection, on lines of its own. */
export function codeBlock(selection: TextSelection): TextSelection {
    const { text, start } = selection
    const startsLine = start === 0 || text[start - 1] === '\n'
    return wrapSelection(selection, `${startsLine ? '' : '\n'}\`\`\`\n`, '\n```\n')
}

/** Inserts text at the cursor (replacing the selection) and puts the cursor after it. */
export function insertText({ text, start, end }: TextSelection, inserted: string): TextSelection {
    const cursor = start + inserted.length
    return { text: `${text.slice(0, start)}${inserted}${text.slice(end)}`, start: cursor, end: cursor }
}
