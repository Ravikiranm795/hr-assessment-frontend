import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { ErrorState } from '@/components/ErrorState'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { basePath, type AuditDetail, type Scope } from './types'

interface Props {
  scope: Scope
  id: string | null
  onClose: () => void
}

function Json({ label, value, none }: { label: string; value: unknown; none: string }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{label}</h3>
      {value === null || value === undefined ? (
        <p className="text-sm text-muted">{none}</p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-(--radius) bg-bg p-3 font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  )
}

/** One entry with before/after values; sensitive fields arrive already redacted from the backend. */
export function DetailModal({ scope, id, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const query = useQuery({ queryKey: ['audit', scope, 'detail', id], queryFn: () => api.get<AuditDetail>(`${basePath(scope)}/${id}`), enabled: id !== null })
  const d = query.data
  const actionLabel = (a: string) => (i18n.exists(`audit.actions.${a}`) ? t(`audit.actions.${a}`) : a)

  return (
    <Modal open={id !== null} onOpenChange={(open) => !open && onClose()} title={t('audit.detail.title')} description={d ? actionLabel(d.action) : undefined} wide>
      {query.isPending && id !== null && <Spinner label={t('common.loading')} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {d && (
        <div className="space-y-5">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">{t('audit.detail.when')}</dt>
            <dd>{formatDateTime(d.created_at, me?.organization?.timezone)}</dd>
            <dt className="text-muted">{t('audit.detail.actor')}</dt>
            <dd>{[d.actor_name, d.actor_role && `(${d.actor_role})`].filter(Boolean).join(' ') || t(`audit.actorType.${d.actor_type}`, { defaultValue: d.actor_type })}</dd>
            <dt className="text-muted">{t('audit.detail.action')}</dt>
            <dd>{actionLabel(d.action)}</dd>
            <dt className="text-muted">{t('audit.detail.entity')}</dt>
            <dd className="font-mono text-xs">{[d.entity_type, d.entity_id].filter(Boolean).join(' · ')}</dd>
            <dt className="text-muted">{t('audit.detail.result')}</dt>
            <dd><Badge tone={d.result === 'success' ? 'success' : 'error'}>{t(`audit.result.${d.result}`, { defaultValue: d.result })}</Badge></dd>
            {d.reason && (<><dt className="text-muted">{t('audit.detail.reason')}</dt><dd>{d.reason}</dd></>)}
            {d.ip && (<><dt className="text-muted">{t('audit.detail.ip')}</dt><dd className="font-mono text-xs">{d.ip}</dd></>)}
            {d.user_agent && (<><dt className="text-muted">{t('audit.detail.agent')}</dt><dd className="text-xs break-all">{d.user_agent}</dd></>)}
            {d.request_id && (<><dt className="text-muted">{t('audit.detail.request')}</dt><dd className="font-mono text-xs">{d.request_id}</dd></>)}
            {scope === 'platform' && d.org_id && (<><dt className="text-muted">{t('audit.detail.organization')}</dt><dd className="font-mono text-xs">{d.org_id}</dd></>)}
          </dl>
          <div className="grid gap-4 md:grid-cols-2">
            <Json label={t('audit.detail.before')} value={d.before} none={t('audit.detail.none')} />
            <Json label={t('audit.detail.after')} value={d.after} none={t('audit.detail.none')} />
          </div>
          <p className="text-xs text-muted">{t('audit.detail.redacted')}</p>
        </div>
      )}
    </Modal>
  )
}
