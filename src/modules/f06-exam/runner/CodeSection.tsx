import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodeEditor } from '@/components/code-editor/CodeEditor'
import { LanguageSelect } from '@/components/code-editor/LanguageSelect'
import { isCodeLanguage, type CodeLanguage } from '@/components/code-editor/languages'
import { Button } from '@/components/Button'
import { Html } from '@/components/Html'
import { cn } from '@/core/utils'
import { examApi } from '../examApi'
import { examErrorText } from '../errors'
import type { AnswerValue, ExamQuestion, RunResult } from '../types'

interface CodeOptions {
  enabled: boolean
  languages: string[]
}

// One request per page load: the runner's languages do not change while the candidate is writing.
let optionsCache: Promise<CodeOptions> | null = null
function loadOptions(): Promise<CodeOptions> {
  if (!optionsCache) {
    optionsCache = examApi.codeOptions().catch((error: unknown) => {
      optionsCache = null
      throw error
    })
  }
  return optionsCache
}

interface CodeSectionProps {
  question: ExamQuestion
  answer: unknown
  onChange: (value: AnswerValue) => void
  /** Sends the pending autosave now; used before every run. */
  flush: () => Promise<boolean>
}

const STATUS_KEY = {
  passed: 'exam.code.passed',
  failed: 'exam.code.failed',
  error: 'exam.code.errored',
  timeout: 'exam.code.timeout',
} as const

function Output({ label, value, empty }: { label: string; value: string; empty?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted">{label}</p>
      <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-bg px-2 py-1.5 font-mono text-xs whitespace-pre-wrap select-text">
        {value === '' && empty ? empty : value}
      </pre>
    </div>
  )
}

export function CodeSection({ question, answer, onChange, flush }: CodeSectionProps) {
  const { t } = useTranslation()
  const languages = useMemo(() => (question.languages ?? []).filter(isCodeLanguage), [question.languages])
  const saved = (answer && typeof answer === 'object' ? answer : {}) as { text?: unknown; language?: unknown }
  const fallback: CodeLanguage =
    isCodeLanguage(question.code_language) && languages.includes(question.code_language)
      ? question.code_language
      : (languages[0] ?? 'javascript')
  const language =
    typeof saved.language === 'string' && isCodeLanguage(saved.language) && languages.includes(saved.language)
      ? saved.language
      : fallback
  // The starter code only fills an empty slate: once the candidate has saved anything (even nothing), their text wins.
  const code = typeof saved.text === 'string' ? saved.text : (question.starter_code ?? '')

  const [options, setOptions] = useState<CodeOptions | 'failed' | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadOptions().then(
      (out) => !cancelled && setOptions(out),
      () => !cancelled && setOptions('failed'),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const canRun = options !== null && options !== 'failed' && options.enabled && options.languages.includes(language)
  const runnerOff = options === 'failed' || (options !== null && !options.enabled)

  const run = async () => {
    setRunning(true)
    setRunError(null)
    try {
      await flush()
      setResult(await examApi.runCode({ question_id: question.id, language, code }))
    } catch (error) {
      setRunError(examErrorText(error))
    } finally {
      setRunning(false)
    }
  }

  const samples = question.samples ?? []
  const headingId = `question-${question.id}`

  return (
    <section aria-labelledby={headingId} className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 space-y-5">
        <h2 id={headingId} tabIndex={-1} className="text-lg font-semibold outline-none">
          {t('exam.code.statement')}
        </h2>
        <Html html={question.prompt_html} className="leading-relaxed" />
        {samples.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('exam.code.samples')}</h3>
            <ul className="space-y-3">
              {samples.map((sample, i) => (
                <li key={i} className="space-y-2 rounded-(--radius) border border-border bg-bg p-3">
                  <p className="text-sm font-medium">{t('exam.code.sample', { number: i + 1 })}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Output label={t('exam.code.input')} value={sample.input ?? ''} empty={t('exam.code.empty')} />
                    <Output label={t('exam.code.expected')} value={sample.expected ?? ''} empty={t('exam.code.empty')} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LanguageSelect
            value={language}
            allowed={languages}
            label={t('exam.code.language')}
            onChange={(next) => {
              setResult(null)
              setRunError(null)
              onChange({ text: code, language: next })
            }}
          />
          {canRun && (
            <Button onClick={() => void run()} loading={running} disabled={running}>
              {t(running ? 'exam.code.running' : 'exam.code.run')}
            </Button>
          )}
        </div>

        <div className="[&_.cm-content]:select-text">
          <CodeEditor
            value={code}
            language={language}
            label={t('exam.code.editorLabel')}
            height="20rem"
            onChange={(text) => onChange({ text, language })}
          />
        </div>

        {canRun && <p className="text-xs text-muted">{t('exam.code.runAdvice')}</p>}
        {options !== null && !canRun && (
          <p className="text-sm text-muted">{t(runnerOff ? 'exam.code.runDisabled' : 'exam.code.runUnsupported')}</p>
        )}
        {runError && (
          <p role="alert" className="rounded-(--radius) border border-warning bg-surface p-3 text-sm">
            {runError}
          </p>
        )}

        <div role="status" aria-live="polite" aria-label={t('exam.code.results')}>
          {running && <p className="text-sm text-muted">{t('exam.code.running')}</p>}
          {result && !running && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t('exam.code.summary', { passed: result.passed, total: result.total })}</p>
              <p className="text-xs text-muted">{t('exam.code.summaryNote')}</p>
              <ul className="space-y-3">
                {result.results.map((r) => (
                  <li
                    key={r.index}
                    className={cn(
                      'space-y-2 rounded-(--radius) border bg-surface p-3',
                      r.status === 'passed' ? 'border-success' : 'border-error',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {t('exam.code.sample', { number: r.index + 1 })}: {t(STATUS_KEY[r.status])}
                      </span>
                      <span className="text-xs text-muted">{t('exam.code.time', { ms: r.time_ms })}</span>
                    </div>
                    {r.status !== 'passed' && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Output label={t('exam.code.expected')} value={r.expected} empty={t('exam.code.empty')} />
                        <Output label={t('exam.code.actual')} value={r.actual} empty={t('exam.code.empty')} />
                      </div>
                    )}
                    {r.stderr && <Output label={t('exam.code.error')} value={r.stderr} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
