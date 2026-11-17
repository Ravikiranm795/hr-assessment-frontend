import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
  const [done, setDone] = useState<Report | null>(null)
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
      setDone(r)
      void queryClient.invalidateQueries({ queryKey: ['reports', scope, 'history'] })
    },
  })

  const download = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await requestFile(`${basePath(scope)}/${report.id}/download`)
      saveBlob(blob, filename ?? `report.${done?.format ?? format}`)
    },
    onSuccess: () => toast.success(t('reports.download.done')),
    onError: () => void queryClient.invalidateQueries({ queryKey: ['reports', scope, 'history'] }),
  })

  const toggle = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setPicked(next)
  }

  if (done) {
    return (
      <section aria-labelledby="report-done" className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
        <h2 id="report-done" className="text-lg font-semibold">{t('reports.done.title')}</h2>
        <p className="text-sm text-muted">
          {t('reports.done.body', { count: done.row_count ?? 0, rows: formatNumber(done.row_count ?? 0), format: (done.format ?? format).toUpperCase() })}
        </p>
        <p className="text-sm text-muted">{t('reports.retention')}</p>
        {download.error && <ReportError error={download.error} scope={scope} />}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download.mutate()} loading={download.isPending}>{t('reports.download.button')}</Button>
          <Button variant="outline" onClick={onReset}>{t('reports.another')}</Button>
        </div>
      </section>
    )
  }

  return (
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
  )
}
