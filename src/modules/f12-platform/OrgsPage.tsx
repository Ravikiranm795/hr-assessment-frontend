import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { api } from '@/core/api/client'
import { formatDateTime } from '@/core/utils'
import { OrgStatusBadge, PageHeader } from './common'
import { CreateOrgDialog } from './CreateOrgDialog'
import { platformKeys } from './queries'
import { TempPasswordDialog } from './TempPasswordDialog'
import type { Org, Paged, TempPassword } from './types'

export function OrgsPage() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 20, sort: 'name:asc' })
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [temp, setTemp] = useState<TempPassword | null>(null)

  const query = useQuery({
    queryKey: [...platformKeys.orgs, list, q, status],
    queryFn: () => api.get<Paged<Org>>('/api/v1/platform/orgs', { page: list.page, page_size: list.pageSize, sort: list.sort, q: q || undefined, status: status || undefined }),
    placeholderData: (previous) => previous,
  })

  const columns: Column<Org>[] = [
    {
      key: 'name',
      header: t('platform.orgs.columns.name'),
      sortField: 'name',
      cell: (o) => (
        <div>
          <Link to={`/platform/orgs/${o.id}/overview`} className="font-medium text-primary hover:underline">
            {o.name}
          </Link>
          <p className="text-xs text-muted">{o.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('platform.orgs.columns.status'),
      sortField: 'status',
      cell: (o) => (
        <div className="flex gap-1.5">
          <OrgStatusBadge status={o.status} />
          {o.is_demo && <Badge tone="info">{t('platform.orgs.demo')}</Badge>}
        </div>
      ),
    },
    { key: 'created', header: t('platform.orgs.columns.created'), sortField: 'created_at', cell: (o) => formatDateTime(o.created_at) },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t('platform.orgs.title')} subtitle={t('platform.orgs.subtitle')} actions={<Button onClick={() => setCreating(true)}>{t('platform.orgs.add')}</Button>} />

      <div className="flex flex-wrap gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="orgs-search" className="sr-only">
            {t('platform.orgs.search')}
          </label>
          <input
            id="orgs-search"
            type="search"
            placeholder={t('platform.orgs.search')}
            className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setList((s) => ({ ...s, page: 1 }))
            }}
          />
        </div>
        <div>
          <label htmlFor="orgs-status" className="sr-only">
            {t('platform.orgs.filter.status')}
          </label>
          <select
            id="orgs-status"
            className="h-10 rounded-(--radius) border border-border bg-surface px-3 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setList((s) => ({ ...s, page: 1 }))
            }}
          >
            <option value="">{t('platform.orgs.filter.all')}</option>
            <option value="active">{t('platform.orgStatus.active')}</option>
            <option value="disabled">{t('platform.orgStatus.disabled')}</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        total={query.data?.total ?? 0}
        state={list}
        onState={setList}
        rowKey={(o) => o.id}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('platform.orgs.empty.title')}
        emptyBody={t('platform.orgs.empty.body')}
      />

      <CreateOrgDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(created) => {
          void client.invalidateQueries({ queryKey: platformKeys.orgs })
          setTemp({ name: created.admin.name, password: created.temporary_password })
        }}
      />
      <TempPasswordDialog value={temp} onClose={() => setTemp(null)} />
    </div>
  )
}
