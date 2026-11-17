import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { useToast } from '@/components/Toast'
import { api, requestFile, saveBlob } from '@/core/api/client'
import { ApiError } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime, formatNumber } from '@/core/utils'
import { useLabels } from './lib'
import { basePath, type HistoryPage, type Report, type Scope } from './types'

const TONE = { interpreted: 'neutral', confirmed: 'info', generated: 'success', failed: 'error' } as const

/** Past requests, newest first. The file is kept 7 days; the request row stays. */
export function HistoryList({ scope }: { scope: Scope }) {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { me } = useAuth()
  const labels = useLabels()
  const tz = me?.organization?.timezone
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 10, sort: 'created_at:desc' })

  const query = useQuery({
    queryKey: ['reports', scope, 'history', list],
    queryFn: () => api.get<HistoryPage>(basePath(scope), { page: list.page, page_size: list.pageSize, sort: list.sort }),
    placeholderData: (previous) => previous,
  })

  const download = useMutation({
    mutationFn: async (r: Report) => {
      const { blob, filename } = await requestFile(`${basePath(scope)}/${r.id}/download`)
      saveBlob(blob, filename ?? `report.${r.format ?? 'csv'}`)
    },
    onSuccess: () => toast.success(t('reports.download.done')),
    onError: (e) => {
      // The nightly cleanup may have removed the file since the list was loaded.
      if (e instanceof ApiError && e.is('NOT_FOUND')) toast.info(t('reports.errors.expired'))
      else toast.error(e)
      void queryClient.invalidateQueries({ queryKey: ['reports', scope, 'history'] })
    },
  })

  const request = (r: Report) => {
    if (r.user_text) return r.user_text
    const n = r.filter_spec?.filters.length ?? 0
    return t('reports.history.structured', { count: n })
  }

  const columns: Column<Report>[] = [
    { key: 'when', header: t('reports.history.when'), sortField: 'created_at', cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.created_at, tz)}</span> },
    { key: 'request', header: t('reports.history.request'), cell: (r) => <span className="line-clamp-2 max-w-md">{request(r)}</span> },
    { key: 'source', header: t('reports.history.source'), cell: (r) => labels.source(r.filter_spec?.source ?? r.source) },
    { key: 'status', header: t('reports.history.status'), cell: (r) => <Badge tone={TONE[r.status]}>{t(`reports.status.${r.status}`)}</Badge> },
    {
      key: 'result',
      header: t('reports.history.result'),
      cell: (r) => (r.status === 'generated' ? `${(r.format ?? '').toUpperCase()} · ${t('reports.history.rows', { count: r.row_count ?? 0, rows: formatNumber(r.row_count ?? 0) })}` : '–'),
    },
    {
      key: 'file',
      header: t('reports.history.file'),
      className: 'w-36 text-right',
      cell: (r) =>
        r.file_available ? (
          <Button size="sm" variant="outline" onClick={() => download.mutate(r)} loading={download.isPending && download.variables?.id === r.id} aria-label={`${t('reports.download.button')}: ${request(r)}`}>
            {t('reports.download.button')}
          </Button>
        ) : r.status === 'generated' ? (
          <span className="text-xs text-muted">{t('reports.history.expired')}</span>
        ) : (
          <span className="text-xs text-muted">{t('reports.history.noFile')}</span>
        ),
    },
  ]

  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <div>
        <h2 id="history-title" className="text-lg font-semibold">{t('reports.history.title')}</h2>
        <p className="text-sm text-muted">{scope === 'org' ? t('reports.history.orgWide') : t('reports.history.platformWide')} {t('reports.retention')}</p>
      </div>
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
        emptyTitle={t('reports.history.empty.title')}
        emptyBody={t('reports.history.empty.body')}
      />
    </section>
  )
}
