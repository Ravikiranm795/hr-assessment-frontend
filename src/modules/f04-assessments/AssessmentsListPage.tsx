import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { cn, formatDateTime } from '@/core/utils'
import { assessmentsApi, canEditAssessment, keys, type AssessmentListItem, type ListParams } from './api'
import { CreateAssessmentDialog } from './CreateAssessmentDialog'
import { PreviewDialog } from './preview/PreviewDialog'
import { Menu } from './ui/Menu'

interface TeamUser {
  id: string
  name: string
}

/** `/assessments`: searchable, filterable list with row actions (spec F4). */
export function AssessmentsListPage() {
  const { t } = useTranslation()
  const { me, role, hasFlag } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const timeZone = me?.organization?.timezone
  const userId = me?.user.id

  const [listState, setListState] = useState<ListState>({ page: 1, pageSize: 20, sort: 'updated_at:desc' })
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ListParams['status']>('active')
  const [mine, setMine] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<AssessmentListItem | null>(null)
  const [previewing, setPreviewing] = useState<AssessmentListItem | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(search.trim())
      setListState((s) => ({ ...s, page: 1 }))
    }, 300)
    return () => window.clearTimeout(id)
  }, [search])

  const params: ListParams = { page: listState.page, pageSize: listState.pageSize, sort: listState.sort, q, status, mine }
  const list = useQuery({
    queryKey: keys.list(params),
    queryFn: ({ signal }) => assessmentsApi.list(params, signal),
    placeholderData: keepPreviousData,
  })

  // Only organization admins may read the team, so only they see owner names; HRs see "You" / "Colleague".
  const canReadTeam = role === 'org_admin' && hasFlag('team')
  const team = useQuery({
    queryKey: ['assessments', 'team-names'],
    queryFn: () => api.get<{ items: TeamUser[] }>('/api/v1/team/users', { page_size: 100 }),
    enabled: canReadTeam,
    staleTime: 5 * 60_000,
  })
  const ownerNames = useMemo(() => new Map((team.data?.items ?? []).map((u) => [u.id, u.name])), [team.data])

  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.all })

  const duplicate = useMutation({
    mutationFn: (id: string) => assessmentsApi.duplicate(id),
    onSuccess: (copy) => {
      toast.success(t('assessments.list.duplicated'))
      void refresh()
      navigate(`/assessments/${copy.id}`)
    },
    onError: toast.error,
  })
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? assessmentsApi.unarchive(id) : assessmentsApi.archive(id),
    onSuccess: (_, v) => {
      toast.success(t(v.archived ? 'assessments.list.unarchived' : 'assessments.list.archived'))
      void refresh()
    },
    onError: toast.error,
  })
  const remove = useMutation({
    mutationFn: (id: string) => assessmentsApi.remove(id),
    onSuccess: () => {
      toast.success(t('assessments.list.deleted'))
      setDeleting(null)
      void refresh()
    },
    onError: (error) => {
      setDeleting(null)
      if (error instanceof ApiError && error.code === 'CONFLICT') toast.info(t('assessments.list.deleteBlocked'))
      else toast.error(error)
    },
  })

  const ownerLabel = (row: AssessmentListItem) =>
    row.owner_id === userId ? t('assessments.list.ownerYou') : (ownerNames.get(row.owner_id) ?? t('assessments.list.ownerColleague'))

  const columns: Column<AssessmentListItem>[] = [
    {
      key: 'title',
      header: t('assessments.list.col.title'),
      sortField: 'title',
      cell: (row) => (
        <div className="max-w-md">
          <Link to={`/assessments/${row.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {row.title}
          </Link>
          {row.description && <p className="truncate text-xs text-muted">{row.description}</p>}
        </div>
      ),
    },
    { key: 'owner', header: t('assessments.list.col.owner'), cell: ownerLabel },
    {
      key: 'status',
      header: t('assessments.list.col.status'),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{t(`assessments.status.${row.status}`)}</Badge>
          {row.latest_published_version_id && <Badge>{t('assessments.status.published')}</Badge>}
          {row.has_draft && <Badge tone="warning">{t('assessments.status.draft')}</Badge>}
        </div>
      ),
    },
    {
      key: 'versions',
      header: t('assessments.list.col.versions'),
      cell: (row) => t('assessments.list.versionsCell', { latest: row.latest_version_no ?? 0, count: row.version_count }),
    },
    {
      key: 'updated',
      header: t('assessments.list.col.updated'),
      sortField: 'updated_at',
      cell: (row) => formatDateTime(row.updated_at, timeZone),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'w-16 text-right',
      cell: (row) => {
        const editable = canEditAssessment(role, userId, row.owner_id)
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Menu
              trigger={
                <Button variant="ghost" size="sm" aria-label={t('assessments.list.actionsFor', { title: row.title })}>
                  ⋯
                </Button>
              }
              items={[
                {
                  key: 'edit',
                  label: editable ? t('assessments.list.action.edit') : t('assessments.list.action.view'),
                  onSelect: () => navigate(`/assessments/${row.id}`),
                },
                { key: 'duplicate', label: t('assessments.list.action.duplicate'), onSelect: () => duplicate.mutate(row.id) },
                { key: 'preview', label: t('assessments.list.action.preview'), onSelect: () => setPreviewing(row) },
                {
                  key: 'archive',
                  label: row.status === 'archived' ? t('assessments.list.action.unarchive') : t('assessments.list.action.archive'),
                  disabled: !editable,
                  onSelect: () => archive.mutate({ id: row.id, archived: row.status === 'archived' }),
                },
                { key: 'delete', label: t('assessments.list.action.delete'), disabled: !editable, danger: true, onSelect: () => setDeleting(row) },
              ]}
            />
          </div>
        )
      },
    },
  ]

  const filtered = q !== '' || status !== 'active' || mine
  const createButton = <Button onClick={() => setCreating(true)}>{t('assessments.list.create')}</Button>

  return (
    <div className="space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('assessments.list.title')}</h1>
          <p className="text-sm text-muted">{t('assessments.list.subtitle')}</p>
        </div>
        {createButton}
      </header>

      <div className="flex flex-wrap items-end gap-4" role="search">
        <div className="space-y-1.5">
          <label htmlFor="assessments-search" className="block text-sm font-medium">
            {t('assessments.list.search')}
          </label>
          <input
            id="assessments-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('assessments.list.searchPlaceholder')}
            className="h-10 w-72 rounded-(--radius) border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="assessments-status" className="block text-sm font-medium">
            {t('assessments.list.statusFilter')}
          </label>
          <select
            id="assessments-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ListParams['status'])
              setListState((s) => ({ ...s, page: 1 }))
            }}
            className="h-10 rounded-(--radius) border border-border bg-surface px-3 text-sm"
          >
            <option value="active">{t('assessments.status.active')}</option>
            <option value="archived">{t('assessments.status.archived')}</option>
            <option value="">{t('assessments.list.statusAll')}</option>
          </select>
        </div>
        <label className={cn('flex h-10 items-center gap-2 text-sm')}>
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked)
              setListState((s) => ({ ...s, page: 1 }))
            }}
          />
          {t('assessments.list.mine')}
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.items}
        total={list.data?.total ?? 0}
        state={listState}
        onState={setListState}
        rowKey={(row) => row.id}
        loading={list.isFetching}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyTitle={filtered ? t('assessments.list.emptyFiltered.title') : t('assessments.list.empty.title')}
        emptyBody={filtered ? t('assessments.list.emptyFiltered.body') : t('assessments.list.empty.body')}
        emptyAction={filtered ? undefined : createButton}
        onRowClick={(row) => navigate(`/assessments/${row.id}`)}
      />

      <CreateAssessmentDialog open={creating} onOpenChange={setCreating} />
      <PreviewDialog
        open={previewing !== null}
        onOpenChange={(open) => !open && setPreviewing(null)}
        assessmentId={previewing?.id ?? null}
        versionId={null}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('assessments.list.deleteTitle')}
        body={t('assessments.list.deleteBody', { title: deleting?.title ?? '' })}
        confirmLabel={t('assessments.list.action.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}
