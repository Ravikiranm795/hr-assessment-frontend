import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/core/utils'
import { Button } from './Button'

interface PagerProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

/** Pager for the shared list contract: page from 1, `{ items, total, page, page_size }` (spec 8.4). */
export function Pager({ page, pageSize, total, onPage }: PagerProps) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <nav className="flex items-center justify-between gap-4 py-3 text-sm" aria-label={t('common.pager.summary', { page, pages, total: formatNumber(total) })}>
      <span className="text-muted">{t('common.pager.summary', { page, pages, total: formatNumber(total) })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('common.pager.previous')}
        </Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t('common.pager.next')}
        </Button>
      </div>
    </nav>
  )
}
