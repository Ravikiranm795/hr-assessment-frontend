import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { api } from '@/core/api/client'
import { formatDateTime } from '@/core/utils'
import { useOrgContext } from './queries'
import type { OrgUser, Paged } from './types'

/** Read-only list of an organization's users (spec F12). */
export function UsersTab() {
  const { t } = useTranslation()
  const org = useOrgContext()
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 20, sort: 'name:asc' })
  const query = useQuery({
    queryKey: ['platform', 'org', org.id, 'users', list],
    queryFn: () => api.get<Paged<OrgUser>>(`/api/v1/platform/orgs/${org.id}/users`, { page: list.page, page_size: list.pageSize, sort: list.sort }),
    placeholderData: (previous) => previous,
  })

  const columns: Column<OrgUser>[] = [
    {
      key: 'name',
      header: t('platform.users.columns.name'),
      sortField: 'name',
      cell: (u) => (
        <div>
          <p className="font-medium">{u.name}</p>
          <p className="text-xs text-muted">{u.email}</p>
        </div>
      ),
    },
    { key: 'role', header: t('platform.users.columns.role'), cell: (u) => t(`platform.role.${u.role}`, { defaultValue: u.role }) },
    {
      key: 'status',
      header: t('platform.users.columns.status'),
      cell: (u) => (
        <div className="flex gap-1.5">
          <Badge tone={u.status === 'active' ? 'success' : 'neutral'}>{t(`platform.userStatus.${u.status}`, { defaultValue: u.status })}</Badge>
          {u.is_locked && <Badge tone="warning">{t('platform.userStatus.locked')}</Badge>}
        </div>
      ),
    },
    { key: 'last', header: t('platform.users.columns.lastLogin'), cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : t('platform.users.never')) },
  ]

  return (
    <DataTable
      columns={columns}
      rows={query.data?.items}
      total={query.data?.total ?? 0}
      state={list}
      onState={setList}
      rowKey={(u) => u.id}
      loading={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('platform.users.empty')}
    />
  )
}
