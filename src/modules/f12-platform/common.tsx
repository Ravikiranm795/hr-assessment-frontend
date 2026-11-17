import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'

export function OrgStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  return <Badge tone={status === 'active' ? 'success' : 'neutral'}>{t(`platform.orgStatus.${status}`, { defaultValue: status })}</Badge>
}

/** Loading or error placeholder for a query-backed block; renders children once data is there. */
export function QueryBlock({ query, children }: { query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }; children: ReactNode }) {
  const { t } = useTranslation()
  if (query.isPending) return <Spinner label={t('common.loading')} className="py-10" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  return <>{children}</>
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
      {title && <h2 className="text-sm font-semibold text-muted">{title}</h2>}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}
