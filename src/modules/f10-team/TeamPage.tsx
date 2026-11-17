import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { AddUserDialog } from './AddUserDialog'
import { DeactivateDialog } from './DeactivateDialog'
import { RowActions } from './RowActions'
import { TempPasswordDialog } from './TempPasswordDialog'
import type { TempPassword, TeamPage as Page, TeamUser } from './types'

export function TeamPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const client = useQueryClient()

  const [list, setList] = useState<ListState>({ page: 1, pageSize: 20, sort: 'name:asc' })
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [status, setStatus] = useState('')
  const [adding, setAdding] = useState(false)
  const [deactivating, setDeactivating] = useState<TeamUser | null>(null)
  const [temp, setTemp] = useState<TempPassword | null>(null)

  const query = useQuery({
    queryKey: ['team', 'users', list, q, status],
    queryFn: () => api.get<Page>('/api/v1/team/users', { page: list.page, page_size: list.pageSize, sort: list.sort, q: q || undefined, status: status || undefined }),
    placeholderData: (previous) => previous,
  })
  const refresh = () => void client.invalidateQueries({ queryKey: ['team'] })

  const columns: Column<TeamUser>[] = [
    {
      key: 'name',
      header: t('team.columns.name'),
      sortField: 'name',
      cell: (u) => (
        <div>
          <p className="font-medium">{u.name}</p>
          <p className="text-xs text-muted">{u.email}</p>
        </div>
      ),
    },
    { key: 'role', header: t('team.columns.role'), cell: (u) => t(`team.role.${u.role}`, { defaultValue: u.role }) },
    {
      key: 'status',
      header: t('team.columns.status'),
      cell: (u) => (
        <div className="flex gap-1.5">
          <Badge tone={u.status === 'active' ? 'success' : 'neutral'}>{t(`team.status.${u.status}`, { defaultValue: u.status })}</Badge>
          {u.is_locked && <Badge tone="warning">{t('team.status.locked')}</Badge>}
        </div>
      ),
    },
    { key: 'last', header: t('team.columns.lastLogin'), sortField: 'last_login_at', cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at, tz) : t('team.neverSignedIn')) },
    {
      key: 'actions',
      header: t('team.columns.actions'),
      className: 'w-28 text-right',
      cell: (u) =>
        u.role === 'hr_user' ? (
          <RowActions user={u} onChanged={refresh} onDeactivate={setDeactivating} onTempPassword={(name, password) => setTemp({ name, password })} />
        ) : (
          <span className="text-xs text-muted" title={t('team.readOnlyHint')}>
            {t('team.readOnly')}
          </span>
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('team.title')}</h1>
          <p className="text-sm text-muted">{t('team.subtitle')}</p>
        </div>
        <Button onClick={() => setAdding(true)}>{t('team.add')}</Button>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="team-search" className="sr-only">
            {t('team.search')}
          </label>
          <input
            id="team-search"
            type="search"
            placeholder={t('team.search')}
            className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setList((s) => ({ ...s, page: 1 }))
            }}
          />
        </div>
        <div>
          <label htmlFor="team-status" className="sr-only">
            {t('team.filter.status')}
          </label>
          <select
            id="team-status"
            className="h-10 rounded-(--radius) border border-border bg-surface px-3 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setList((s) => ({ ...s, page: 1 }))
            }}
          >
            <option value="">{t('team.filter.all')}</option>
            <option value="active">{t('team.filter.active')}</option>
            <option value="inactive">{t('team.filter.inactive')}</option>
          </select>
        </div>
      </div>

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
        emptyTitle={t('team.empty.title')}
        emptyBody={t('team.empty.body')}
      />

      <AddUserDialog open={adding} onOpenChange={setAdding} onCreated={(user, password) => { refresh(); setTemp({ name: user.name, password }) }} />
      <DeactivateDialog user={deactivating} onClose={() => setDeactivating(null)} onDone={refresh} />
      <TempPasswordDialog value={temp} onClose={() => setTemp(null)} />
    </div>
  )
}
