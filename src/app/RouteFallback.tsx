import { useTranslation } from 'react-i18next'

/** Shown while a lazily loaded page chunk downloads. */
export function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      {t('common.loading')}
    </div>
  )
}
