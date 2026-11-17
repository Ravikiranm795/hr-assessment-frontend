import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { cn } from '@/core/utils'
import type { CatalogItem, Layout, LayoutItem, Size } from './types'

/**
 * Add, remove, resize and reorder gadgets for the signed-in user (spec F-18, Settings > Dashboard gadgets).
 * Ordering uses explicit up/down buttons so it works with keyboard and screen readers.
 */
export function GadgetsSettingsPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const client = useQueryClient()
  const layout = useQuery({ queryKey: ['dashboard', 'layout'], queryFn: () => api.get<Layout>('/api/v1/dashboard/layout') })
  const catalog = useQuery({ queryKey: ['dashboard', 'catalog'], queryFn: () => api.get<{ items: CatalogItem[] }>('/api/v1/dashboard/gadgets/catalog') })
  const [rows, setRows] = useState<LayoutItem[]>([])

  // Start from the saved layout, then append any catalog gadget the user has not placed yet (disabled).
  useEffect(() => {
    if (!layout.data || !catalog.data) return
    const placed = new Set(layout.data.items.map((i) => i.key))
    const extra = catalog.data.items.filter((c) => !placed.has(c.key)).sort((a, b) => a.default_order - b.default_order).map((c): LayoutItem => ({ key: c.key, size: 'md', enabled: false }))
    setRows([...layout.data.items.filter((i) => catalog.data.items.some((c) => c.key === i.key)), ...extra])
  }, [layout.data, catalog.data])

  const save = useMutation({
    mutationFn: () => api.put('/api/v1/dashboard/layout', { gadgets: rows }),
    onSuccess: () => {
      toast.success(t('dashboard.editor.saved'))
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: toast.error,
  })

  const titleOf = (key: string) => {
    const k = catalog.data?.items.find((c) => c.key === key)?.title_key ?? `gadgets.${key}.title`
    return i18n.exists(k) ? t(k) : key
  }
  const patch = (key: string, p: Partial<LayoutItem>) => setRows((r) => r.map((i) => (i.key === key ? { ...i, ...p } : i)))
  const move = (index: number, delta: number) =>
    setRows((r) => {
      const next = [...r]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('dashboard.editor.title')}</h1>
        <p className="text-sm text-muted">{t('dashboard.editor.subtitle')}</p>
      </header>
      {(layout.isPending || catalog.isPending) && <Spinner label={t('common.loading')} className="py-10" />}
      {(layout.isError || catalog.isError) && <ErrorState error={layout.error ?? catalog.error} onRetry={() => { void layout.refetch(); void catalog.refetch() }} />}

      {rows.length > 0 && (
        <>
          <ol className="divide-y divide-border rounded-(--radius) border border-border bg-surface shadow-card">
            {rows.map((row, index) => (
              <li key={row.key} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !row.enabled && 'opacity-60')}>
                <input
                  id={`g-${row.key}`}
                  type="checkbox"
                  className="size-4 accent-(--color-primary)"
                  checked={row.enabled}
                  onChange={(e) => patch(row.key, { enabled: e.target.checked })}
                />
                <label htmlFor={`g-${row.key}`} className="min-w-0 flex-1 text-sm font-medium">
                  <span className="sr-only">{t('dashboard.editor.show')}: </span>
                  {titleOf(row.key)}
                </label>
                <label className="sr-only" htmlFor={`s-${row.key}`}>
                  {t('dashboard.editor.size')}: {titleOf(row.key)}
                </label>
                <select id={`s-${row.key}`} className="h-9 rounded-(--radius) border border-border bg-surface px-2 text-sm" value={row.size} onChange={(e) => patch(row.key, { size: e.target.value as Size })}>
                  {(['sm', 'md', 'lg'] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`dashboard.editor.size_${s}`)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1" role="group" aria-label={t('dashboard.editor.moveLabel', { title: titleOf(row.key), n: index + 1, total: rows.length })}>
                  <Button size="sm" variant="outline" disabled={index === 0} aria-label={`${t('dashboard.editor.up')}: ${titleOf(row.key)}`} onClick={() => move(index, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="outline" disabled={index === rows.length - 1} aria-label={`${t('dashboard.editor.down')}: ${titleOf(row.key)}`} onClick={() => move(index, 1)}>
                    ↓
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {t('dashboard.editor.save')}
          </Button>
        </>
      )}
    </div>
  )
}
