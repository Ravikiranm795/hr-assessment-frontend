import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { useAuth } from '@/core/auth/AuthProvider'
import { RoleFormDialog } from './RoleFormDialog'
import { useRole, useRoles, useTeamUsers, type RoleFilters } from './api'
import type { RoleRow } from './types'
import { Badge, SelectField } from './ui'

const STATUSES = ['draft', 'open', 'closed']
const inputClass = 'h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm'

function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

/**
 * The role list has no linked-assessment title or progress counts, so those two cells read the role
 * detail (cached and shared with the detail page). See API_GAPS.
 */
function RoleExtra({ id, part }: { id: string; part: 'assessment' | 'progress' }) {
  const { t } = useTranslation()
  const { data, isError } = useRole(id)
  if (isError) return <>—</>
  if (!data) return <span className="text-muted">…</span>
  if (part === 'assessment') {
    return data.assessment ? (
      <span>
        {data.assessment.assessment_title} <span className="text-muted">v{data.assessment.version_no}</span>
      </span>
    ) : (
      <span className="text-muted">{t('roles.list.notLinked')}</span>
    )
  }
  const { invites } = data.progress
  return (
    <span className="whitespace-nowrap">
      {t('roles.list.progress', {
        invited: invites.invited ?? 0,
        started: invites.started ?? 0,
        submitted: invites.submitted ?? 0,
      })}
    </span>
  )
}

export function RolesListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { role: myRole } = useAuth()
  const isAdmin = myRole === 'org_admin'
  const [state, setState] = useState<ListState>({ page: 1, pageSize: 20 })
  const [text, setText] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('')
  const [owner, setOwner] = useState('')
  const [mine, setMine] = useState(false)
  const [creating, setCreating] = useState(false)
  const q = useDebounced(text)
  const department = useDebounced(dept)
  const filters: RoleFilters = { q, status, department, owner_id: owner, mine }
  const roles = useRoles(filters, state.page, state.pageSize, state.sort)
  const team = useTeamUsers(isAdmin)

  const filtered = Boolean(q || department || status || owner || mine)
  const resetPage = () => setState((s) => ({ ...s, page: 1 }))

  const columns: Column<RoleRow>[] = [
    {
      key: 'title',
      header: t('roles.list.title'),
      sortField: 'title',
      cell: (r) => (
        <Link to={`/roles/${r.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {r.title}
        </Link>
      ),
    },
    { key: 'department', header: t('roles.list.department'), cell: (r) => r.department ?? '—' },
    { key: 'level', header: t('roles.list.level'), cell: (r) => r.experience_level ?? '—' },
    { key: 'vacancies', header: t('roles.list.vacancies'), cell: (r) => r.vacancies },
    {
      key: 'owner',
      header: t('roles.list.owner'),
      cell: (r) => (
        <span>
          {r.owner_name ?? '—'}
          {r.owner_inactive && (
            <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">{t('roles.list.ownerInactive')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('roles.list.status'),
      sortField: 'status',
      cell: (r) => <Badge value={r.status} label={t(`roles.status.${r.status}`, { defaultValue: r.status })} />,
    },
    { key: 'assessment', header: t('roles.list.assessment'), cell: (r) => <RoleExtra id={r.id} part="assessment" /> },
    { key: 'progress', header: t('roles.list.progressHeader'), cell: (r) => <RoleExtra id={r.id} part="progress" /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('roles.list.heading')}</h1>
        <Button onClick={() => setCreating(true)}>{t('roles.list.create')}</Button>
      </div>

      <form role="search" className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
        <div className="w-64 space-y-1.5">
          <label htmlFor="roles-search" className="block text-sm font-medium">
            {t('roles.list.search')}
          </label>
          <input
            id="roles-search"
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              resetPage()
            }}
            className={inputClass}
          />
        </div>
        <div className="w-44 space-y-1.5">
          <label htmlFor="roles-dept" className="block text-sm font-medium">
            {t('roles.list.department')}
          </label>
          <input
            id="roles-dept"
            value={dept}
            onChange={(e) => {
              setDept(e.target.value)
              resetPage()
            }}
            className={inputClass}
          />
        </div>
        <div className="w-40">
          <SelectField
            label={t('roles.list.status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              resetPage()
            }}
          >
            <option value="">{t('roles.list.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`roles.status.${s}`)}
              </option>
            ))}
          </SelectField>
        </div>
        {isAdmin && (
          <div className="w-52">
            <SelectField
              label={t('roles.list.owner')}
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value)
                resetPage()
              }}
            >
              <option value="">{t('roles.list.allOwners')}</option>
              {(team.data?.items ?? [])
                .filter((u) => u.role === 'hr_user' || u.role === 'org_admin')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </SelectField>
          </div>
        )}
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked)
              resetPage()
            }}
          />
          {t('roles.list.mine')}
        </label>
      </form>

      <DataTable
        columns={columns}
        rows={roles.data?.items}
        total={roles.data?.total ?? 0}
        state={state}
        onState={setState}
        rowKey={(r) => r.id}
        loading={roles.isFetching}
        error={roles.error}
        onRetry={() => void roles.refetch()}
        emptyTitle={filtered ? t('roles.list.noMatchTitle') : t('roles.list.emptyTitle')}
        emptyBody={filtered ? t('roles.list.noMatchBody') : t('roles.list.emptyBody')}
        emptyAction={!filtered && <Button onClick={() => setCreating(true)}>{t('roles.list.create')}</Button>}
        onRowClick={(r) => navigate(`/roles/${r.id}`)}
      />

      <RoleFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(created) => {
          setCreating(false)
          navigate(`/roles/${created.id}`)
        }}
      />
    </div>
  )
}
