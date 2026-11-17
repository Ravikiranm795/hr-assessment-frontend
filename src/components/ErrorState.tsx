import { useTranslation } from 'react-i18next'
import { ApiError, errorText } from '@/core/api/errors'
import { Button } from './Button'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
}

/** Inline error for a failed query: translated text from `message_key`, plus the request id. */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()
  const requestId = error instanceof ApiError ? error.requestId : null
  return (
    <div role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-4 text-sm">
      <p className="font-medium text-error">{errorText(error)}</p>
      {requestId && <p className="mt-1 font-mono text-xs text-muted">{t('common.requestId', { id: requestId })}</p>}
      {onRetry && (
        <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}
