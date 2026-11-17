import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { api } from '@/core/api/client'
import { formatNumber } from '@/core/utils'
import { PageHeader } from './common'
import type { Paged, UsageItem } from './types'

interface Usage extends Paged<UsageItem> {
  month: string
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** AI call counts per organization for one month. Metadata only: counts and tokens, never content. */
export function UsagePage() {
  const { t } = useTranslation()
  const [month, setMonth] = useState(currentMonth())
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 20, sort: 'calls:desc' })

  const query = useQuery({
    queryKey: ['platform', 'usage', month, list],
    queryFn: () => api.get<Usage>('/api/v1/platform/usage', { month: month || undefined, page: list.page, page_size: list.pageSize, sort: list.sort }),
    placeholderData: (previous) => previous,
  })

  const columns: Column<UsageItem>[] = [
    { key: 'org', header: t('platform.usage.columns.org'), sortField: 'org_name', cell: (u) => <span className="font-medium">{u.org_name}</span> },
    { key: 'calls', header: t('platform.usage.columns.calls'), sortField: 'calls', className: 'text-right', cell: (u) => formatNumber(u.calls) },
    { key: 'in', header: t('platform.usage.columns.tokensIn'), sortField: 'tokens_in', className: 'text-right', cell: (u) => formatNumber(u.tokens_in) },
    { key: 'out', header: t('platform.usage.columns.tokensOut'), sortField: 'tokens_out', className: 'text-right', cell: (u) => formatNumber(u.tokens_out) },
    {
      key: 'features',
      header: t('platform.usage.columns.features'),
      cell: (u) => {
        const entries = Object.entries(u.by_feature)
        return entries.length === 0 ? (
          <span className="text-muted">{t('platform.usage.none')}</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {entries.map(([feature, calls]) => (
              <li key={feature}>
                {t(`platform.usage.feature.${feature}`, { defaultValue: feature })}: {formatNumber(calls)}
              </li>
            ))}
          </ul>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={t('platform.usage.title')}
        subtitle={t('platform.usage.subtitle')}
        actions={
          <div>
            <label htmlFor="usage-month" className="block text-sm font-medium">
              {t('platform.usage.month')}
            </label>
            <input
              id="usage-month"
              type="month"
              className="mt-1 h-10 rounded-(--radius) border border-border bg-surface px-3 text-sm"
              value={month}
              max={currentMonth()}
              onChange={(e) => {
                setMonth(e.target.value)
                setList((s) => ({ ...s, page: 1 }))
              }}
            />
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        total={query.data?.total ?? 0}
        state={list}
        onState={setList}
        rowKey={(u) => u.org_id}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('platform.usage.empty')}
      />
    </div>
  )
}
