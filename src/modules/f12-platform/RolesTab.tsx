import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { api } from '@/core/api/client'
import { formatDateTime } from '@/core/utils'
import { useOrgContext } from './queries'
import type { OrgRole, Paged } from './types'

/** Read-only list of an organization's roles with the owner (spec F12). No candidate content is shown. */
export function RolesTab() {
  const { t } = useTranslation()
  const org = useOrgContext()
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 20 })
  const query = useQuery({
    queryKey: ['platform', 'org', org.id, 'roles', list],
    queryFn: () => api.get<Paged<OrgRole>>(`/api/v1/platform/orgs/${org.id}/roles`, { page: list.page, page_size: list.pageSize, sort: list.sort }),
    placeholderData: (previous) => previous,
  })

  const columns: Column<OrgRole>[] = [
    {
      key: 'title',
      header: t('platform.roles.columns.title'),
      sortField: 'title',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          {r.department && <p className="text-xs text-muted">{r.department}</p>}
        </div>
      ),
    },
    { key: 'status', header: t('platform.roles.columns.status'), cell: (r) => <Badge tone={r.status === 'open' ? 'success' : 'neutral'}>{t(`platform.roleStatus.${r.status}`, { defaultValue: r.status })}</Badge> },
    {
      key: 'owner',
      header: t('platform.roles.columns.owner'),
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          {r.owner_name}
          {r.owner_inactive && <Badge tone="warning">{t('platform.roles.ownerInactive')}</Badge>}
        </span>
      ),
    },
    { key: 'created', header: t('platform.roles.columns.created'), cell: (r) => formatDateTime(r.created_at) },
  ]

  return (
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
      emptyTitle={t('platform.roles.empty')}
    />
  )
}
