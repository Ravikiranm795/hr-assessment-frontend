import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, requestFile, saveBlob } from '@/core/api/client'
import { formatNumber } from '@/core/utils'
import { ReportError } from './ReportError'
import { findSource, useCatalog, useLabels, useSpecSummary } from './lib'
import { ROW_CAPS, basePath, type Format, type Report, type Scope } from './types'

interface Props {
  scope: Scope
  /** A confirmed report: the filter is fixed, columns and format are still open. */
  report: Report
  onReset: () => void
}

interface Result {
  key: number
  report: Report
  format: Format
  /** The file once fetched (kept in memory so an older format stays downloadable). */
  blob: Blob | null
  filename: string | null
}
let resultSeq = 0

/** Steps after the filter is confirmed: row count, columns, format, generate, download. */
export function ConfirmedPanel({ scope, report, onReset }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const labels = useLabels()
  const summarize = useSpecSummary()
  const catalog = useCatalog(scope)
  const spec = report.filter_spec
  const source = findSource(catalog.data, spec?.source)
  const aggregate = spec?.aggregate ?? null

  const [format, setFormat] = useState<Format>('csv')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  // Every generation adds a result card below the form; the form stays so the other format can be made next.
  const [results, setResults] = useState<Result[]>([])
  const [latestKey, setLatestKey] = useState<number | null>(null)
  const selected = picked ?? new Set(report.columns ?? [])
  // Columns keep the catalog's order, whatever order they were ticked in.
  const orderedColumns = source ? source.fields.filter((f) => selected.has(f.name)).map((f) => f.name) : [...selected]

  const count = useQuery({
    queryKey: ['reports', scope, 'count', report.id],
    queryFn: () => api.post<{ id: string; row_count: number }>(`${basePath(scope)}/${report.id}/preview-count`, {}),
  })
  const rows = count.data?.row_count ?? null
  const overCap = rows !== null && rows > ROW_CAPS[format]

  const generate = useMutation({
    mutationFn: () =>
      api.post<Report>(`${basePath(scope)}/${report.id}/generate`, aggregate ? { format } : { format, columns: orderedColumns }),
    onSuccess: (r) => {
      // One card per format: generating the same format again refreshes its card instead of adding another.
      const fresh: Result = { key: ++resultSeq, report: r, format: r.format ?? format, blob: null, filename: null }
      setLatestKey(fresh.key)
      setResults((list) =>
        list.some((x) => x.format === fresh.format) ? list.map((x) => (x.format === fresh.format ? fresh : x)) : [...list, fresh],
      )
      void queryClient.invalidateQueries({ queryKey: ['reports', scope, 'history'] })
    },
  })

  // The server keeps only the newest file per report, so only the newest card can fetch; a fetched file
  // is kept in memory on its card, which is how both a CSV and a PDF can be downloaded for one report.
  const download = useMutation({
    mutationFn: async (result: Result) => {
      let { blob, filename } = result
      if (!blob) {
        const file = await requestFile(`${basePath(scope)}/${report.id}/download`)
        blob = file.blob
        filename = file.filename ?? `report.${result.format}`
        setResults((list) => list.map((x) => (x.key === result.key ? { ...x, blob, filename } : x)))
      }
      saveBlob(blob, filename ?? `report.${result.format}`)
    },
    onSuccess: () => toast.success(t('reports.download.done')),
    onError: () => void queryClient.invalidateQueries({ queryKey: ['reports', scope, 'history'] }),
  })

  // Bring a freshly added result into view (it appears below the form).
  const lastResult = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (latestKey !== null) lastResult.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [latestKey])

  const toggle = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setPicked(next)
  }

  return (
    <div className="space-y-6">
    <section aria-labelledby="report-confirmed" className="space-y-5 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="report-confirmed" className="text-lg font-semibold">{t('reports.confirmed.title')}</h2>
          <p className="text-sm text-muted">{labels.source(spec?.source ?? report.source)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>{t('reports.startOver')}</Button>
      </div>

      {spec && (
        <div>
          <p className="mb-1 text-sm font-medium">{t('reports.confirmed.conditions')}</p>
          {spec.filters.length === 0 ? (
            <p className="text-sm text-muted">{t('reports.confirmed.noConditions')}</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">{summarize(spec).map((line, i) => <li key={i}>{line}</li>)}</ul>
          )}
          {aggregate && (
            <p className="mt-1 text-sm">
              {t(aggregate.bucket === 'month' ? 'reports.confirmed.countByMonth' : 'reports.confirmed.countBy', { field: labels.fieldName(aggregate.group_by) })}
            </p>
          )}
        </div>
      )}

      <div aria-live="polite" className="text-sm" data-testid="row-count">
        {count.isPending ? (
          <Spinner label={t('reports.count.loading')} className="justify-start" />
        ) : count.error ? (
          <ReportError error={count.error} scope={scope} />
        ) : (
          <p>
            <span className="font-semibold">{t('reports.count.rows', { count: rows ?? 0, rows: formatNumber(rows ?? 0) })}</span>
          </p>
        )}
      </div>

      {!aggregate && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('reports.columns.title')}</legend>
          <p className="mb-2 text-xs text-muted">{t('reports.columns.hint')}</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(source?.fields ?? []).map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.has(f.name)} onChange={() => toggle(f.name)} className="accent-(--color-primary)" />
                {labels.field(f)}
                {f.pii && <Badge tone="warning">{t('reports.columns.pii')}</Badge>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t('reports.format.title')}</legend>
        {(['csv', 'pdf'] as const).map((f) => (
          <label key={f} className="flex items-center gap-2 text-sm">
            <input type="radio" name="report-format" checked={format === f} onChange={() => setFormat(f)} className="accent-(--color-primary)" />
            {t(`reports.format.${f}`, { max: formatNumber(ROW_CAPS[f]) })}
          </label>
        ))}
      </fieldset>

      {overCap && (
        <p role="status" className="rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm">
          {t('reports.errors.rowCap', { max: formatNumber(ROW_CAPS[format]), format: format.toUpperCase() })}
        </p>
      )}
      {generate.error && <ReportError error={generate.error} format={format} scope={scope} />}

      <div className="flex justify-end">
        <Button
          onClick={() => generate.mutate()}
          loading={generate.isPending}
          disabled={overCap || count.isPending || (!aggregate && selected.size === 0)}
        >
          {t('reports.generate')}
        </Button>
      </div>
    </section>

    {results.map((result) => {
      const latest = result.key === latestKey
      const rowCount = result.report.row_count ?? 0
      // Older cards can only download if their file was already fetched.
      const canDownload = latest || result.blob !== null
      return (
        <section
          key={result.key}
          ref={latest ? lastResult : undefined}
          aria-label={t('reports.done.title')}
          className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card"
        >
          <h2 className="text-lg font-semibold">{t('reports.done.title')}</h2>
          <p className="text-sm text-muted">
            {t('reports.done.body', { count: rowCount, rows: formatNumber(rowCount), format: result.format.toUpperCase() })}
          </p>
          {latest && <p className="text-sm text-muted">{t('reports.retention')}</p>}
          {!canDownload && <p className="text-sm text-muted">{t('reports.done.replaced', { format: result.format.toUpperCase() })}</p>}
          {latest && download.error && <ReportError error={download.error} scope={scope} />}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download.mutate(result)} loading={download.isPending && download.variables?.key === result.key} disabled={!canDownload}>
              {t('reports.download.button')} ({result.format.toUpperCase()})
            </Button>
            {latest && <Button variant="outline" onClick={onReset}>{t('reports.another')}</Button>}
          </div>
        </section>
      )
    })}
    </div>
  )
}
