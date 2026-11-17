import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { cn } from '@/core/utils'
import { GADGETS } from './gadgets'
import { SIZE_CLASS, type CatalogItem, type GadgetData, type Layout, type LayoutItem } from './types'

const REFRESH_MS = 60_000

function GadgetCard({ item, title }: { item: LayoutItem; title: string }) {
  const { t } = useTranslation()
  const { me } = useAuth()
  const query = useQuery({
    queryKey: ['dashboard', 'gadget', item.key],
    queryFn: () => api.get<{ key: string; data: GadgetData }>(`/api/v1/dashboard/gadgets/${item.key}/data`),
    refetchInterval: REFRESH_MS,
  })
  const Render = GADGETS[item.key]
  return (
    <section className={cn('flex flex-col rounded-(--radius) border border-border bg-surface shadow-card', SIZE_CLASS[item.size])} aria-label={title}>
      <h2 className="shrink-0 border-b border-border px-4 py-3 text-sm font-semibold">{title}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {query.isPending && <Spinner label={t('dashboard.gadget.loading')} className="py-6" />}
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {/* Rendered as a component (not called as a function): gadgets use hooks of their own. */}
        {query.data && Render && <Render data={query.data.data} tz={me?.organization?.timezone} />}
      </div>
    </section>
  )
}

/** Gadget grid saved per user (spec F3, F-18). Every number inside links to the list behind it. */
export function DashboardPage({ platform = false }: { platform?: boolean }) {
  const { t, i18n } = useTranslation()
  const { me, hasFlag } = useAuth()
  const layout = useQuery({ queryKey: ['dashboard', 'layout'], queryFn: () => api.get<Layout>('/api/v1/dashboard/layout') })
  const catalog = useQuery({ queryKey: ['dashboard', 'catalog'], queryFn: () => api.get<{ items: CatalogItem[] }>('/api/v1/dashboard/gadgets/catalog'), staleTime: 10 * 60_000 })

  const titles = new Map(catalog.data?.items.map((c) => [c.key, c.title_key]))
  const titleOf = (key: string) => {
    const k = titles.get(key) ?? `gadgets.${key}.title`
    return i18n.exists(k) ? t(k) : key
  }
  const enabled = (layout.data?.items ?? []).filter((i) => i.enabled && GADGETS[i.key])
  const canCustomize = !platform && hasFlag('dashboard_gadgets')

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{platform ? t('dashboard.platformTitle') : t('dashboard.title')}</h1>
          <p className="text-sm text-muted">{t('dashboard.greeting', { name: me?.user.name })}</p>
        </div>
        {canCustomize && (
          <Link to="/settings/dashboard" className={buttonStyles({ variant: 'outline' })}>
            {t('dashboard.customize')}
          </Link>
        )}
      </header>

      {layout.isPending && <Spinner label={t('common.loading')} className="py-20" />}
      {layout.isError && <ErrorState error={layout.error} onRetry={() => void layout.refetch()} />}
      {layout.data && enabled.length === 0 && (
        <EmptyState
          title={t('dashboard.empty.title')}
          body={t('dashboard.empty.body')}
          action={canCustomize ? <Link to="/settings/dashboard" className={buttonStyles({ variant: 'primary' })}>{t('dashboard.empty.action')}</Link> : undefined}
        />
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {enabled.map((item) => (
          <GadgetCard key={item.key} item={item} title={titleOf(item.key)} />
        ))}
      </div>
    </div>
  )
}
