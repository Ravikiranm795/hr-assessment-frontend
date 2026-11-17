import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { DecisionModal, type Mode } from './DecisionModal'
import type { HelpRequest, Page } from './types'

const STATUSES = ['open', 'approved', 'declined']
const tone = { open: 'warning', approved: 'success', declined: 'error' } as const

export function InboxPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const [state, setState] = useState<ListState>({ page: 1, pageSize: 20 })
  const [status, setStatus] = useState('')
  const [active, setActive] = useState<{ request: HelpRequest; mode: Mode } | null>(null)

  const list = useQuery({
    queryKey: ['inbox', status, state.page, state.pageSize],
    queryFn: () =>
      api.get<Page<HelpRequest>>('/api/v1/help-requests', { status, page: state.page, page_size: state.pageSize }),
    placeholderData: keepPreviousData,
  })

  const columns: Column<HelpRequest>[] = [
    { key: 'candidate', header: t('inbox.candidate'), cell: (r) => <span className="font-medium">{r.candidate_name}</span> },
    {
      key: 'role',
      header: t('inbox.role'),
      cell: (r) => (
        <Link to={`/roles/${r.role_id}`} className="text-primary hover:underline">
          {r.role_title}
        </Link>
      ),
    },
    {
      key: 'reason',
      header: t('inbox.reason'),
      cell: (r) => (
        <div>
          <div>{t(`inbox.reasons.${r.reason}`, { defaultValue: r.reason })}</div>
          {r.note && <div className="text-xs text-muted">{r.note}</div>}
        </div>
      ),
    },
    { key: 'requested', header: t('inbox.requested'), cell: (r) => formatDateTime(r.created_at, tz) },
    {
      key: 'status',
      header: t('inbox.status'),
      cell: (r) => (
        <Badge tone={tone[r.status as keyof typeof tone] ?? 'neutral'}>{t(`inbox.statuses.${r.status}`, { defaultValue: r.status })}</Badge>
      ),
    },
    {
      key: 'decision',
      header: t('inbox.decision'),
      cell: (r) =>
        r.status === 'open' ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setActive({ request: r, mode: 'approve' })}>
              {t('inbox.approve')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setActive({ request: r, mode: 'decline' })}>
              {t('inbox.decline')}
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted">
            {r.decided_at && <div>{formatDateTime(r.decided_at, tz)}</div>}
            {r.decision_note && <div>{r.decision_note}</div>}
          </div>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('inbox.heading')}</h1>
        <div className="w-48 space-y-1.5">
          <label htmlFor="inbox-status" className="block text-sm font-medium">
            {t('inbox.filterStatus')}
          </label>
          <select
            id="inbox-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setState({ ...state, page: 1 })
            }}
            className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
          >
            <option value="">{t('inbox.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`inbox.statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.items}
        total={list.data?.total ?? 0}
        state={state}
        onState={setState}
        rowKey={(r) => r.id}
        loading={list.isFetching}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyTitle={t('inbox.emptyTitle')}
        emptyBody={t('inbox.emptyBody')}
      />

      {active && <DecisionModal request={active.request} mode={active.mode} onClose={() => setActive(null)} />}
    </div>
  )
}
