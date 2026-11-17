import { useTranslation } from 'react-i18next'
import { ApiError, errorText } from '@/core/api/errors'
import { rowCapOf } from './lib'
import type { Format, Scope } from './types'

const FILTER_PATH = /^filters\.(\d+)\.(field|op|value)$/

/** Error box for any failed report call, with the specific cause where the backend gives one. */
export function ReportError({ error, format, scope }: { error: unknown; format?: Format; scope: Scope }) {
  const { t, i18n } = useTranslation()
  if (!error) return null
  const cap = rowCapOf(error, format)
  const apiError = error instanceof ApiError ? error : null

  let main = errorText(error)
  let hint: string | null = null
  const details: string[] = []

  if (cap !== null) {
    main = t('reports.errors.rowCap', { max: cap.toLocaleString(), format: (format ?? 'csv').toUpperCase() })
  } else if (apiError?.is('AI_NOT_CONFIGURED', 'AI_LIMIT_REACHED')) {
    hint = scope === 'org' ? t(`reports.errors.hint.${apiError.code}`) : null
  } else if (apiError?.is('REPORT_FILTER_INVALID')) {
    for (const f of apiError.fieldErrors) {
      const code = i18n.exists(`reports.filterCodes.${f.code}`) ? t(`reports.filterCodes.${f.code}`) : t('fieldErrors.invalid')
      const m = FILTER_PATH.exec(f.field)
      details.push(m ? t('reports.errors.filterPart', { n: Number(m[1]) + 1, part: t(`reports.errors.part.${m[2]}`), problem: code }) : code)
    }
  } else if (apiError?.is('NOT_FOUND') && apiError.details.reason === 'file_not_available') {
    main = t('reports.errors.expired')
  }

  return (
    <div role="alert" className="space-y-1 rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
      <p className="font-medium">{main}</p>
      {hint && <p className="text-text">{hint}</p>}
      {details.length > 0 && (
        <ul className="list-disc pl-5">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {apiError?.requestId && <p className="font-mono text-xs text-muted">{t('common.requestId', { id: apiError.requestId })}</p>}
    </div>
  )
}
