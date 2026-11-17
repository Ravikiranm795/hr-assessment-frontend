import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { Pager } from './Pager'
import { Spinner } from './Spinner'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Backend sort field; when set the header toggles `field:asc|desc`. */
  sortField?: string
  className?: string
}

export interface ListState {
  page: number
  pageSize: number
  /** `field:asc` or `field:desc`, comma-separated for several keys. */
  sort?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  total: number
  state: ListState
  onState: (next: ListState) => void
  rowKey: (row: T) => string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  emptyTitle?: string
  emptyBody?: string
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  columns,
  rows,
  total,
  state,
  onState,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyBody,
  emptyAction,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (loading && !rows) return <Spinner label={t('common.loading')} className="py-10" />
  if (rows && rows.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />

  const [sortField, sortDir] = (state.sort ?? '').split(':')
  const toggle = (field: string) =>
    onState({ ...state, page: 1, sort: `${field}:${sortField === field && sortDir === 'asc' ? 'desc' : 'asc'}` })

  return (
    <div className="overflow-hidden rounded-(--radius) border border-border bg-surface shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-bg text-muted">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('px-4 py-3 font-medium', c.className)}
                aria-sort={c.sortField && sortField === c.sortField ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {c.sortField ? (
                  <button type="button" className="font-medium hover:text-text" onClick={() => toggle(c.sortField!)}>
                    {c.header}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn(loading && 'opacity-60')}>
          {rows?.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn('border-t border-border', onRowClick && 'cursor-pointer hover:bg-bg')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-border px-4">
        <Pager page={state.page} pageSize={state.pageSize} total={total} onPage={(page) => onState({ ...state, page })} />
      </div>
    </div>
  )
}
