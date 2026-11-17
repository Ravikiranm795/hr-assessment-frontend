import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/core/api/client'
import { ApiError } from '@/core/api/errors'
import { ROW_CAPS, basePath, type Catalog, type CatalogField, type CatalogSource, type Format, type FilterSpec, type Scope } from './types'

export const inputClass = 'h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm'

/** The field catalog drives both the labels and the filter builder. It contains no data rows. */
export function useCatalog(scope: Scope) {
  return useQuery({
    queryKey: ['reports', scope, 'catalog'],
    queryFn: () => api.get<Catalog>(`${basePath(scope)}/catalog`),
    staleTime: 10 * 60_000,
  })
}

export function findSource(catalog: Catalog | undefined, source: string | undefined): CatalogSource | undefined {
  return catalog?.sources.find((s) => s.source === source)
}

/** Readable names for fields, sources, operators and values, all from the module's own locale. */
export function useLabels() {
  const { t, i18n } = useTranslation()
  return {
    field: (f: Pick<CatalogField, 'name' | 'label_key'>) => (i18n.exists(f.label_key) ? t(f.label_key) : f.name),
    fieldName: (name: string) => (i18n.exists(`reports.fields.${name}`) ? t(`reports.fields.${name}`) : name),
    source: (source: string) => (i18n.exists(`reports.sources.${source}`) ? t(`reports.sources.${source}`) : source),
    value: (field: string, value: string) => (i18n.exists(`reports.values.${field}.${value}`) ? t(`reports.values.${field}.${value}`) : value),
    op: (op: string) => (i18n.exists(`reports.ops.${op}`) ? t(`reports.ops.${op}`) : op),
  }
}

interface RowCapField {
  field: string
  code: string
  max?: number
}

/** The row cap carried by a `REPORT_FILTER_INVALID` (row_cap_exceeded) or `too_many_rows` error, if any. */
export function rowCapOf(error: unknown, format?: Format): number | null {
  if (!(error instanceof ApiError)) return null
  const hit = (error.fieldErrors as RowCapField[]).find((f) => f.code === 'row_cap_exceeded' || f.code === 'too_many_rows')
  if (!hit) return null
  return hit.max ?? error.details.max_rows ?? ROW_CAPS[format ?? 'csv']
}

/** One readable line per filter condition of a spec. */
export function useSpecSummary() {
  const { t } = useTranslation()
  const labels = useLabels()
  return (spec: FilterSpec): string[] =>
    spec.filters.map((f) => {
      const show = (v: unknown) => {
        if (typeof v === 'boolean') return v ? t('reports.values.yes') : t('reports.values.no')
        return labels.value(f.field, String(v))
      }
      const value = Array.isArray(f.value) ? f.value.map(show).join(f.op === 'between' ? ' – ' : ', ') : show(f.value)
      return `${labels.fieldName(f.field)} ${labels.op(f.op)} ${value}`
    })
}
