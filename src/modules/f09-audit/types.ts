export type Scope = 'org' | 'platform'

export interface AuditRow {
  id: string
  created_at: string
  org_id: string | null
  actor_type: string
  actor_user_id: string | null
  actor_name: string | null
  actor_role: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  result: string
  reason: string | null
  ip: string | null
  request_id: string | null
}

export interface AuditDetail extends AuditRow {
  user_agent: string | null
  before: unknown
  after: unknown
}

export interface AuditPageData {
  items: AuditRow[]
  total: number
  page: number
  page_size: number
}

export interface ActionGroups {
  groups: { key: string; label_key: string; actions: { action: string; label_key: string }[] }[]
}

export interface ColumnCatalog {
  items: { key: string; label_key: string; default: boolean }[]
}

export interface Filters {
  q: string
  action: string
  result: string
  actorType: string
  entityType: string
  dateFrom: string
  dateTo: string
}

export const EMPTY_FILTERS: Filters = { q: '', action: '', result: '', actorType: '', entityType: '', dateFrom: '', dateTo: '' }

export function basePath(scope: Scope) {
  return scope === 'platform' ? '/api/v1/platform/audit-logs' : '/api/v1/audit-logs'
}

/** Date inputs are whole days: start of the first day to end of the last, in UTC. */
export function filterParams(f: Filters) {
  return {
    q: f.q || undefined,
    action: f.action || undefined,
    result: f.result || undefined,
    actor_type: f.actorType || undefined,
    entity_type: f.entityType || undefined,
    date_from: f.dateFrom ? `${f.dateFrom}T00:00:00Z` : undefined,
    date_to: f.dateTo ? `${f.dateTo}T23:59:59Z` : undefined,
  }
}
