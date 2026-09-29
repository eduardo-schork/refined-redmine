import { useState } from 'react'
import { parseIssuesUrl } from '@domain/redmine/issues-url'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/fields'
import { Field } from '../molecules/Field'

type TestResult = { type: 'count'; count: number } | { type: 'error'; message: string }

/** Address of a Redmine issue list, with a button that shows how many issues it returns. */
export function FilterUrlField({ url, onChange }: { url: string; onChange: (url: string) => void }) {
    const { t, error } = useI18n()
    const [result, setResult] = useState<TestResult>()
    const [testing, setTesting] = useState(false)

    async function test() {
        setTesting(true)
        try {
            const filter = { rawQuery: parseIssuesUrl(url).query }
            const page = await api.issues.list(filter, 1)
            setResult({ type: 'count', count: page.total })
        } catch (testError) {
            setResult({ type: 'error', message: error(testError) })
        } finally {
            setTesting(false)
        }
    }

    const change = (nextUrl: string) => {
        setResult(undefined)
        onChange(nextUrl)
    }

    const resultText = () => {
        if (!result) return t('board.editor.filterHint')
        if (result.type === 'error') return <span className="text-danger">{result.message}</span>
        return <span className="text-ok">{t('board.editor.filterResult', { count: result.count })}</span>
    }

    return (
        <Field label={t('board.editor.filterUrl')} hint={resultText()}>
            <div className="flex items-center gap-2">
                <Input
                    className="flex-1"
                    value={url}
                    placeholder="https://redmine…/projects/…/issues?set_filter=1&…"
                    onChange={(event) => change(event.target.value)}
                />
                <Button onClick={() => void test()} disabled={!url.trim() || testing}>
                    {t('board.editor.filterTest')}
                </Button>
            </div>
        </Field>
    )
}
