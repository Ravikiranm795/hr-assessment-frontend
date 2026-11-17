import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface EmptyStateProps {
  title?: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className="rounded-(--radius) border border-dashed border-border bg-surface p-10 text-center">
      <h2 className="font-semibold">{title ?? t('common.empty.title')}</h2>
      <p className="mt-2 text-sm text-muted">{body ?? t('common.empty.body')}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
