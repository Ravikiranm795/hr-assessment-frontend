import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { DetailModal } from './DetailModal'
import { ExportDialog } from './ExportDialog'
import { EMPTY_FILTERS, basePath, filterParams, type ActionGroups, type AuditPageData, type AuditRow, type Filters, type Scope } from './types'

const input = 'h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm'
const TAB = 'rounded-t-(--radius) border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted data-[state=active]:border-primary data-[state=active]:text-text'

export function AuditPage({ scope }: { scope: Scope }) {
  const { t, i18n } = useTranslation()
  const { me, hasFlag } = useAuth()
  const tz = me?.organization?.timezone
  const platform = scope === 'platform'

  const [tab, setTab] = useState<'all' | 'security'>('all')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const deferredQ = useDeferredValue(filters.q.trim())
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 25, sort: 'created_at:desc' })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setList((s) => ({ ...s, page: 1 }))
  }

  const path = tab === 'security' ? `${basePath(scope)}/security-events` : basePath(scope)
  const effective = { ...filters, q: deferredQ }
  const query = useQuery({
    queryKey: ['audit', scope, tab, list, effective],
    queryFn: () => api.get<AuditPageData>(path, { page: list.page, page_size: list.pageSize, sort: list.sort, ...filterParams(effective) }),
    placeholderData: (previous) => previous,
  })
  const actions = useQuery({ queryKey: ['audit', scope, 'actions'], queryFn: () => api.get<ActionGroups>(`${basePath(scope)}/actions`), staleTime: 10 * 60_000 })

  const actionLabel = (a: string) => (i18n.exists(`audit.actions.${a}`) ? t(`audit.actions.${a}`) : a)
  const filtered = Object.values(filters).some(Boolean)
  const canExport = platform || hasFlag('audit_export')

  const columns: Column<AuditRow>[] = [
    { key: 'when', header: t('audit.columnsHeader.when'), sortField: 'created_at', cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.created_at, tz)}</span> },
    {
      key: 'actor',
      header: t('audit.columnsHeader.actor'),
      cell: (r) => (
        <div>
          <p className="font-medium">{r.actor_name ?? t(`audit.actorType.${r.actor_type}`, { defaultValue: r.actor_type })}</p>
          {r.actor_role && <p className="text-xs text-muted">{r.actor_role}</p>}
        </div>
      ),
    },
    { key: 'action', header: t('audit.columnsHeader.action'), sortField: 'action', cell: (r) => actionLabel(r.action) },
    { key: 'entity', header: t('audit.columnsHeader.entity'), cell: (r) => <span className="font-mono text-xs">{[r.entity_type, r.entity_id?.slice(0, 8)].filter(Boolean).join(' · ')}</span> },
    { key: 'result', header: t('audit.columnsHeader.result'), cell: (r) => <Badge tone={r.result === 'success' ? 'success' : 'error'}>{t(`audit.result.${r.result}`, { defaultValue: r.result })}</Badge> },
    {
      key: 'details',
      header: t('audit.columnsHeader.details'),
      className: 'w-24 text-right',
      cell: (r) => <Button size="sm" variant="ghost" onClick={() => setDetailId(r.id)} aria-label={`${t('audit.view')}: ${actionLabel(r.action)}`}>{t('audit.view')}</Button>,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{platform ? t('audit.platformTitle') : t('audit.title')}</h1>
          <p className="text-sm text-muted">{platform ? t('audit.platformSubtitle') : t('audit.subtitle')}</p>
        </div>
        {canExport && <Button variant="outline" onClick={() => setExporting(true)}>{t('audit.export.button')}</Button>}
      </header>

      {!platform && (
        <Tabs.Root value={tab} onValueChange={(v) => { setTab(v as 'all' | 'security'); setList((s) => ({ ...s, page: 1 })) }}>
          <Tabs.List className="flex gap-1 border-b border-border" aria-label={t('audit.title')}>
            <Tabs.Trigger value="all" className={TAB}>{t('audit.tabs.all')}</Tabs.Trigger>
            <Tabs.Trigger value="security" className={TAB}>{t('audit.tabs.security')}</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2">
          <label htmlFor="audit-q" className="mb-1 block text-xs font-medium text-muted">{t('audit.filters.search')}</label>
          <input id="audit-q" type="search" className={input} placeholder={t('audit.filters.searchPlaceholder')} value={filters.q} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <div>
          <label htmlFor="audit-action" className="mb-1 block text-xs font-medium text-muted">{t('audit.filters.action')}</label>
          <select id="audit-action" className={input} value={filters.action} onChange={(e) => set({ action: e.target.value })} disabled={tab === 'security'}>
            <option value="">{t('audit.filters.allActions')}</option>
            {actions.data?.groups.map((g) => (
              <optgroup key={g.key} label={i18n.exists(g.label_key) ? t(g.label_key) : g.key}>
                {g.actions.map((a) => <option key={a.action} value={a.action}>{actionLabel(a.action)}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-result" className="mb-1 block text-xs font-medium text-muted">{t('audit.filters.result')}</label>
          <select id="audit-result" className={input} value={filters.result} onChange={(e) => set({ result: e.target.value })}>
            <option value="">{t('audit.filters.allResults')}</option>
            {['success', 'failure', 'denied'].map((r) => <option key={r} value={r}>{t(`audit.result.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-actor" className="mb-1 block text-xs font-medium text-muted">{t('audit.filters.actor')}</label>
          <select id="audit-actor" className={input} value={filters.actorType} onChange={(e) => set({ actorType: e.target.value })}>
            <option value="">{t('audit.filters.allActors')}</option>
            {['user', 'candidate', 'system'].map((a) => <option key={a} value={a}>{t(`audit.actorType.${a}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-entity" className="mb-1 block text-xs font-medium text-muted">{t('audit.filters.entity')}</label>
          <input id="audit-entity" className={input} value={filters.entityType} onChange={(e) => set({ entityType: e.target.value.trim() })} />
        </div>
        <div>
          <label htmlFor="audit-from" className="mb-1 block text-xs font-medium text-muted">{t('audit.filters.from')}</label>
          <input id="audit-from" type="date" className={input} value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => set({ dateFrom: e.target.value })} />
        </div>
        <div>
          <label htmlFor="audit-to" className="mb-1 block text-xs font-medium text-muted">{t('audit.filters.to')}</label>
          <input id="audit-to" type="date" className={input} value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => set({ dateTo: e.target.value })} />
        </div>
      </div>
      {filtered && <Button variant="ghost" size="sm" onClick={() => set({ ...EMPTY_FILTERS })}>{t('audit.filters.reset')}</Button>}

      <DataTable
        columns={columns}
        rows={query.data?.items}
        total={query.data?.total ?? 0}
        state={list}
        onState={setList}
        rowKey={(r) => r.id}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('audit.empty.title')}
        emptyBody={t('audit.empty.body')}
      />

      <DetailModal scope={scope} id={detailId} onClose={() => setDetailId(null)} />
      <ExportDialog scope={scope} open={exporting} onOpenChange={setExporting} filters={filters} />
    </div>
  )
}
