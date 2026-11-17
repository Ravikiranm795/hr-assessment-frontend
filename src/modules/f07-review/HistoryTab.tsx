import { useTranslation } from 'react-i18next'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import type { Attempt } from './types'
import { Badge } from '@/components/Badge'

export function HistoryTab({ attempt }: { attempt: Attempt }) {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const label = (prefix: string, value: string) => (i18n.exists(`${prefix}.${value}`) ? t(`${prefix}.${value}`) : value)

  return (
    <div className="space-y-6">
      <section aria-labelledby="hist-help">
        <h3 id="hist-help" className="mb-2 font-semibold">{t('review.history.help')}</h3>
        {attempt.help_requests.length === 0 ? (
          <p className="text-sm text-muted">{t('review.history.noHelp')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface shadow-card">
            {attempt.help_requests.map((h, i) => (
              <li key={h.id ?? i} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {h.reason && <span className="font-medium">{label('review.history.reasonType', h.reason)}</span>}
                  {h.status && <Badge tone={h.status === 'approved' ? 'success' : h.status === 'declined' ? 'error' : 'warning'}>{label('review.history.requestStatus', h.status)}</Badge>}
                  {h.created_at && <span className="text-muted">{formatDateTime(h.created_at, tz)}</span>}
                </div>
                {h.note && <p>{h.note}</p>}
                {h.decision_note && <p className="text-muted">{t('review.history.reason', { value: h.decision_note })}</p>}
                {h.granted_extra_minutes ? <p className="text-muted">{t('review.history.extra', { count: h.granted_extra_minutes })}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist-dec">
        <h3 id="hist-dec" className="mb-2 font-semibold">{t('review.history.decisions')}</h3>
        {attempt.decision_history.length === 0 ? (
          <p className="text-sm text-muted">{t('review.history.noDecisions')}</p>
        ) : (
          <ol className="divide-y divide-border rounded-(--radius) border border-border bg-surface shadow-card">
            {attempt.decision_history.map((d) => (
              <li key={d.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={d.decision === 'approved' ? 'success' : d.decision === 'rejected' ? 'error' : 'neutral'}>{label('review.decision', d.decision)}</Badge>
                  {d.is_override && <Badge tone="warning">{t('review.history.override')}</Badge>}
                  {d.previous_decision && <span className="text-muted">{t('review.history.from', { value: label('review.decision', d.previous_decision) })}</span>}
                  <span className="text-muted">{formatDateTime(d.created_at, tz)}</span>
                </div>
                {d.reason && <p>{t('review.history.reason', { value: d.reason })}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
