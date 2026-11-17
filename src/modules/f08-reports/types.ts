export type Scope = 'org' | 'platform'
export type Format = 'csv' | 'pdf'

/** Row caps enforced by the backend (spec 8.3). */
export const ROW_CAPS: Record<Format, number> = { csv: 50000, pdf: 2000 }

export function basePath(scope: Scope) {
  return scope === 'platform' ? '/api/v1/platform/reports' : '/api/v1/reports'
}

export type Op = 'eq' | 'in' | 'contains' | 'between' | 'gte' | 'lte'
export type FieldType = 'text' | 'int' | 'number' | 'bool' | 'enum' | 'datetime'

export interface CatalogField {
  name: string
  type: FieldType
  label_key: string
  ops: Op[]
  pii: boolean
  sortable: boolean
  groupable: boolean
  values: string[] | null
}

export interface CatalogSource {
  source: string
  default_columns: string[]
  fields: CatalogField[]
}

export interface Catalog {
  sources: CatalogSource[]
}

export interface FilterClause {
  field: string
  op: Op
  value: unknown
}

export interface FilterSpec {
  source: string
  filters: FilterClause[]
  columns: string[]
  sort: { field: string; dir: 'asc' | 'desc' }[]
  aggregate: { group_by: string; bucket: 'month' | null; metric: 'count' } | null
  limit: number
}

export interface Report {
  id: string
  source: string
  user_text: string | null
  status: 'interpreted' | 'confirmed' | 'generated' | 'failed'
  filter_spec: FilterSpec | null
  columns: string[] | null
  format: Format | null
  row_count: number | null
  file_available: boolean
  created_by: string
  created_at: string
}

export interface Interpretation {
  index: number
  label: string
  filter_spec: FilterSpec
  columns: string[]
  estimated_rows: number | null
}

export interface InterpretResponse {
  report: Report
  interpretations: Interpretation[]
  clarifying_question: string | null
  estimated_rows: number | null
}

export interface HistoryPage {
  items: Report[]
  total: number
  page: number
  page_size: number
}
