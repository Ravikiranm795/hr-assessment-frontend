import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import { api } from '@/core/api/client'
import { ReportError } from './ReportError'
import { inputClass, useCatalog, useLabels } from './lib'
import { basePath, type CatalogField, type FilterClause, type FilterSpec, type InterpretResponse, type Op, type Report } from './types'

interface Row {
  id: number
  field: string
  op: Op | ''
  value: string
  value2: string
  values: string[]
}

let nextId = 1
const blank = (): Row => ({ id: nextId++, field: '', op: '', value: '', value2: '', values: [] })

const scalar = (f: CatalogField, s: string): unknown => {
  if (f.type === 'int' || f.type === 'number') return Number(s)
  if (f.type === 'bool') return s === 'true'
  return s.trim()
}

/** The typed filter clause for a row, or null while the row is still incomplete. */
function toClause(row: Row, f: CatalogField | undefined): FilterClause | null {
  if (!f || !row.op) return null
  if (row.op === 'in') return row.values.length > 0 ? { field: f.name, op: 'in', value: row.values } : null
  if (row.op === 'between') return row.value && row.value2 ? { field: f.name, op: 'between', value: [scalar(f, row.value), scalar(f, row.value2)] } : null
  return row.value.trim() ? { field: f.name, op: row.op, value: scalar(f, row.value) } : null
}

function ValueInput({ row, field, onChange }: { row: Row; field: CatalogField; onChange: (patch: Partial<Row>) => void }) {
  const { t } = useTranslation()
  const labels = useLabels()
  const label = t('reports.builder.value')
  const type = field.type === 'datetime' ? 'date' : field.type === 'int' || field.type === 'number' ? 'number' : 'text'

  if (row.op === 'in' && field.values) {
    return (
      <fieldset className="flex flex-wrap gap-x-3 gap-y-1">
        <legend className="sr-only">{label}</legend>
        {field.values.map((v) => (
          <label key={v} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="accent-(--color-primary)"
              checked={row.values.includes(v)}
              onChange={() => onChange({ values: row.values.includes(v) ? row.values.filter((x) => x !== v) : [...row.values, v] })}
            />
            {labels.value(field.name, v)}
          </label>
        ))}
      </fieldset>
    )
  }
  if (field.type === 'bool' || (field.type === 'enum' && field.values)) {
    const options = field.type === 'bool' ? ['true', 'false'] : (field.values ?? [])
    return (
      <select aria-label={label} className={inputClass} value={row.value} onChange={(e) => onChange({ value: e.target.value })}>
        <option value="" />
        {options.map((v) => (
          <option key={v} value={v}>
            {field.type === 'bool' ? t(v === 'true' ? 'reports.values.yes' : 'reports.values.no') : labels.value(field.name, v)}
          </option>
        ))}
      </select>
    )
  }
  if (row.op === 'between') {
    return (
      <div className="flex items-center gap-2">
        <input aria-label={t('reports.builder.from')} type={type} className={inputClass} value={row.value} onChange={(e) => onChange({ value: e.target.value })} />
        <span aria-hidden>–</span>
        <input aria-label={t('reports.builder.to')} type={type} className={inputClass} value={row.value2} onChange={(e) => onChange({ value2: e.target.value })} />
      </div>
    )
  }
  return <input aria-label={label} type={type} className={inputClass} value={row.value} onChange={(e) => onChange({ value: e.target.value })} />
}

/** Super admin filter builder: no AI, just a structured `filter_spec` limited to organization-level data. */
export function BuilderPanel({ onConfirmed }: { onConfirmed: (report: Report) => void }) {
  const { t } = useTranslation()
  const labels = useLabels()
  const catalog = useCatalog('platform')
  const [sourceName, setSourceName] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [mode, setMode] = useState<'rows' | 'count'>('rows')
  const [groupBy, setGroupBy] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [incomplete, setIncomplete] = useState(false)

  const source = catalog.data?.sources.find((s) => s.source === (sourceName || catalog.data?.sources[0]?.source))
  const fields = source?.fields ?? []
  const field = (name: string) => fields.find((f) => f.name === name)
  const groupable = fields.filter((f) => f.groupable && !f.pii)
  const group = field(groupBy) ?? groupable[0]

  const create = useMutation({
    mutationFn: async (spec: Partial<FilterSpec>) => {
      const first = await api.post<InterpretResponse>(`${basePath('platform')}/chat/interpret`, { filter_spec: spec })
      const chosen = await api.post<InterpretResponse>(`${basePath('platform')}/chat/select`, { id: first.report.id, index: first.interpretations[0]?.index ?? 0 })
      return chosen.report
    },
    onSuccess: onConfirmed,
  })

  const patchRow = (id: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const onSource = (name: string) => {
    setSourceName(name)
    setRows([])
    setGroupBy('')
    setSortField('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!source) return
    const clauses = rows.map((r) => toClause(r, field(r.field)))
    if (clauses.some((c) => c === null)) {
      setIncomplete(true)
      return
    }
    setIncomplete(false)
    create.reset()
    const spec: Partial<FilterSpec> = { source: source.source, filters: clauses as FilterClause[] }
    if (mode === 'count' && group) {
      spec.aggregate = { group_by: group.name, bucket: group.type === 'datetime' ? 'month' : null, metric: 'count' }
    } else if (sortField) {
      spec.sort = [{ field: sortField, dir: sortDir }]
    }
    create.mutate(spec)
  }

  if (catalog.isPending) return <Spinner label={t('common.loading')} className="py-10" />
  if (catalog.error) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />

  return (
    <form onSubmit={submit} aria-labelledby="builder-title" className="space-y-5 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
      <div>
        <h2 id="builder-title" className="text-lg font-semibold">{t('reports.builder.title')}</h2>
        <p className="text-sm text-muted">{t('reports.builder.privacy')}</p>
      </div>

      <div className="max-w-xs">
        <label htmlFor="builder-source" className="mb-1 block text-sm font-medium">{t('reports.builder.source')}</label>
        <select id="builder-source" className={inputClass} value={source?.source ?? ''} onChange={(e) => onSource(e.target.value)}>
          {catalog.data?.sources.map((s) => <option key={s.source} value={s.source}>{labels.source(s.source)}</option>)}
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">{t('reports.builder.conditions')}</legend>
        {rows.length === 0 && <p className="text-sm text-muted">{t('reports.builder.noConditions')}</p>}
        {rows.map((r, i) => {
          const f = field(r.field)
          return (
            <div key={r.id} className="grid grid-cols-1 items-start gap-2 rounded-(--radius) border border-border p-3 md:grid-cols-[1fr_9rem_2fr_auto]">
              <select
                aria-label={t('reports.builder.field', { n: i + 1 })}
                className={inputClass}
                value={r.field}
                onChange={(e) => patchRow(r.id, { field: e.target.value, op: field(e.target.value)?.ops[0] ?? '', value: '', value2: '', values: [] })}
              >
                <option value="">{t('reports.builder.pickField')}</option>
                {fields.map((x) => <option key={x.name} value={x.name}>{labels.field(x)}</option>)}
              </select>
              <select
                aria-label={t('reports.builder.operator', { n: i + 1 })}
                className={inputClass}
                value={r.op}
                disabled={!f}
                onChange={(e) => patchRow(r.id, { op: e.target.value as Op, value: '', value2: '', values: [] })}
              >
                {f?.ops.map((o) => <option key={o} value={o}>{labels.op(o)}</option>)}
              </select>
              {f ? <ValueInput row={r} field={f} onChange={(patch) => patchRow(r.id, patch)} /> : <span />}
              <Button variant="ghost" size="sm" onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))} aria-label={t('reports.builder.remove', { n: i + 1 })}>
                {t('reports.builder.removeShort')}
              </Button>
            </div>
          )
        })}
        {incomplete && <p role="alert" className="text-sm text-error">{t('reports.builder.incomplete')}</p>}
        <Button variant="outline" size="sm" onClick={() => setRows((list) => [...list, blank()])} disabled={rows.length >= 20}>
          {t('reports.builder.add')}
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t('reports.builder.output')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="builder-mode" className="accent-(--color-primary)" checked={mode === 'rows'} onChange={() => setMode('rows')} />
          {t('reports.builder.modeRows')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="builder-mode" className="accent-(--color-primary)" checked={mode === 'count'} onChange={() => setMode('count')} />
          {t('reports.builder.modeCount')}
        </label>
        {mode === 'count' ? (
          <div className="max-w-xs">
            <label htmlFor="builder-group" className="mb-1 block text-xs font-medium text-muted">{t('reports.builder.groupBy')}</label>
            <select id="builder-group" className={inputClass} value={group?.name ?? ''} onChange={(e) => setGroupBy(e.target.value)}>
              {groupable.map((f) => <option key={f.name} value={f.name}>{labels.field(f)}</option>)}
            </select>
            {group?.type === 'datetime' && <p className="mt-1 text-xs text-muted">{t('reports.builder.byMonth')}</p>}
          </div>
        ) : (
          <div className="flex max-w-md gap-2">
            <div className="flex-1">
              <label htmlFor="builder-sort" className="mb-1 block text-xs font-medium text-muted">{t('reports.builder.sortBy')}</label>
              <select id="builder-sort" className={inputClass} value={sortField} onChange={(e) => setSortField(e.target.value)}>
                <option value="">{t('reports.builder.noSort')}</option>
                {fields.filter((f) => f.sortable).map((f) => <option key={f.name} value={f.name}>{labels.field(f)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="builder-dir" className="mb-1 block text-xs font-medium text-muted">{t('reports.builder.direction')}</label>
              <select id="builder-dir" className={inputClass} value={sortDir} disabled={!sortField} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
                <option value="asc">{t('reports.builder.asc')}</option>
                <option value="desc">{t('reports.builder.desc')}</option>
              </select>
            </div>
          </div>
        )}
      </fieldset>

      {create.error && <ReportError error={create.error} scope="platform" />}
      <div className="flex justify-end">
        <Button type="submit" loading={create.isPending}>{t('reports.builder.submit')}</Button>
      </div>
    </form>
  )
}
