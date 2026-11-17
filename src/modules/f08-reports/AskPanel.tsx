import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { Textarea } from '@/components/Textarea'
import { api } from '@/core/api/client'
import { formatNumber } from '@/core/utils'
import { ReportError } from './ReportError'
import { inputClass, useCatalog, useLabels } from './lib'
import { basePath, type InterpretResponse, type Interpretation, type Report } from './types'

const MAX_TEXT = 2000
const EXAMPLES = ['rejected', 'roles', 'team'] as const

function ThinkingLoader({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 6000)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <div className="space-y-2 rounded-(--radius) border border-border bg-bg p-4 text-sm" data-testid="interpret-loader">
      <Spinner label={t('reports.ask.thinking')} className="justify-start" />
      <p className="text-muted">{slow ? t('reports.ask.thinkingSlow') : t('reports.ask.thinkingHint')}</p>
      <Button variant="outline" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
    </div>
  )
}

/** Org admin AI chat: ask, pick one interpretation (or refine), confirm. The AI never sees data rows. */
export function AskPanel({ onConfirmed }: { onConfirmed: (report: Report) => void }) {
  const { t } = useTranslation()
  const labels = useLabels()
  const catalog = useCatalog('org')
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [refine, setRefine] = useState('')
  const [data, setData] = useState<InterpretResponse | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const controller = useRef<AbortController | null>(null)

  const accept = (res: InterpretResponse) => {
    setData(res)
    setChoice(res.interpretations[0]?.index ?? null)
    setRefine('')
  }

  const interpret = useMutation({
    mutationFn: () => {
      controller.current = new AbortController()
      return api.post<InterpretResponse>(`${basePath('org')}/chat/interpret`, { text: text.trim(), source: source || undefined }, { signal: controller.current.signal })
    },
    onSuccess: accept,
  })

  const select = useMutation({
    mutationFn: (body: { index: number } | { text: string }) => {
      controller.current = new AbortController()
      return api.post<InterpretResponse>(`${basePath('org')}/chat/select`, { id: data!.report.id, ...body }, { signal: controller.current.signal })
    },
    onSuccess: (res, body) => {
      if ('index' in body) onConfirmed(res.report)
      else accept(res)
    },
  })

  const cancel = () => controller.current?.abort()
  const busy = interpret.isPending || select.isPending
  // An aborted call is the user's own choice, not an error to show.
  const failure = [interpret.error, select.error].find((e) => e && !(e instanceof DOMException && e.name === 'AbortError'))
  const clear = () => {
    interpret.reset()
    select.reset()
  }

  const submitAsk = (e: FormEvent) => {
    e.preventDefault()
    clear()
    setData(null)
    interpret.mutate()
  }

  return (
    <section aria-labelledby="ask-title" className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
      <div>
        <h2 id="ask-title" className="text-lg font-semibold">{t('reports.ask.title')}</h2>
        <p className="text-sm text-muted">{t('reports.ask.privacy')}</p>
      </div>

      <form className="space-y-3" onSubmit={submitAsk}>
        <Textarea
          label={t('reports.ask.label')}
          placeholder={t('reports.ask.placeholder')}
          value={text}
          rows={3}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t('reports.ask.examples')}</span>
          {EXAMPLES.map((k) => (
            <button
              key={k}
              type="button"
              disabled={busy}
              className="rounded-full border border-border px-3 py-1 text-xs hover:bg-bg disabled:opacity-50"
              onClick={() => setText(t(`reports.ask.example.${k}`))}
            >
              {t(`reports.ask.example.${k}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-xs">
            <label htmlFor="report-source" className="mb-1 block text-xs font-medium text-muted">{t('reports.ask.source')}</label>
            <select id="report-source" className={inputClass} value={source} onChange={(e) => setSource(e.target.value)} disabled={busy}>
              <option value="">{t('reports.ask.anySource')}</option>
              {catalog.data?.sources.map((s) => <option key={s.source} value={s.source}>{labels.source(s.source)}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={busy || text.trim().length === 0}>{t('reports.ask.submit')}</Button>
        </div>
      </form>

      {interpret.isPending && <ThinkingLoader onCancel={cancel} />}
      {failure && <ReportError error={failure} scope="org" />}

      {data && !interpret.isPending && (
        <div className="space-y-4 border-t border-border pt-4">
          {data.clarifying_question && (
            <p role="status" className="rounded-(--radius) border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="clarifying-question">
              {data.clarifying_question}
            </p>
          )}

          {data.interpretations.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">{t('reports.choose.title')}</legend>
              {data.interpretations.map((it: Interpretation) => (
                <label
                  key={it.index}
                  className="flex cursor-pointer items-start gap-3 rounded-(--radius) border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input type="radio" name="interpretation" className="mt-1 accent-(--color-primary)" checked={choice === it.index} onChange={() => setChoice(it.index)} disabled={busy} />
                  <span className="space-y-0.5">
                    <span className="block font-medium">{it.label}</span>
                    <span className="block text-xs text-muted">
                      {labels.source(it.filter_spec.source)} ·{' '}
                      {it.estimated_rows === null ? t('reports.choose.noEstimate') : t('reports.choose.estimate', { count: it.estimated_rows, rows: formatNumber(it.estimated_rows) })}
                    </span>
                  </span>
                </label>
              ))}
              <div className="flex justify-end">
                <Button onClick={() => { clear(); if (choice !== null) select.mutate({ index: choice }) }} loading={select.isPending && 'index' in (select.variables ?? {})} disabled={busy || choice === null}>
                  {t('reports.choose.use')}
                </Button>
              </div>
            </fieldset>
          )}

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              clear()
              select.mutate({ text: refine.trim() })
            }}
          >
            <Textarea
              label={t('reports.refine.label')}
              placeholder={t('reports.refine.placeholder')}
              value={refine}
              rows={2}
              maxLength={MAX_TEXT}
              onChange={(e) => setRefine(e.target.value)}
              disabled={busy}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="outline" loading={select.isPending && 'text' in (select.variables ?? {})} disabled={busy || refine.trim().length === 0}>
                {t('reports.refine.submit')}
              </Button>
            </div>
          </form>
          {select.isPending && 'text' in (select.variables ?? {}) && <ThinkingLoader onCancel={cancel} />}
        </div>
      )}
    </section>
  )
}
