import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/core/api/client'
import { formatDateTime, formatNumber } from '@/core/utils'
import { Card, QueryBlock } from './common'
import { useOrgContext } from './queries'
import type { Overview } from './types'

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-(--radius) border border-border bg-bg p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{formatNumber(value)}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function OverviewTab() {
  const { t } = useTranslation()
  const org = useOrgContext()
  const query = useQuery({ queryKey: ['platform', 'org', org.id, 'overview'], queryFn: () => api.get<Overview>(`/api/v1/platform/orgs/${org.id}/overview`) })
  const o = query.data

  return (
    <QueryBlock query={query}>
      {o && (
        <div className="space-y-5">
          <Card title={t('platform.overview.people')}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={t('platform.overview.users')} value={o.users.total} hint={t('platform.overview.usersHint', { active: o.users.active, inactive: o.users.inactive })} />
              <Stat label={t('platform.overview.admins')} value={o.users.org_admins} />
              <Stat label={t('platform.overview.hr')} value={o.users.hr_users} />
            </div>
          </Card>
          <Card title={t('platform.overview.activity')}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={t('platform.overview.openRoles')} value={o.open_roles} hint={t('platform.overview.rolesHint', { total: o.roles_total })} />
              <Stat label={t('platform.overview.invites')} value={o.invites.total} hint={t('platform.overview.invitesHint', { invited: o.invites.invited, submitted: o.invites.submitted })} />
              <Stat label={t('platform.overview.attempts')} value={o.attempts.total} hint={t('platform.overview.attemptsHint', { submitted: o.attempts.submitted })} />
            </div>
          </Card>
          <Card title={t('platform.overview.ai')}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={t('platform.overview.aiCalls')} value={o.ai_usage.calls_this_month} />
            </div>
          </Card>
          <p className="text-xs text-muted">{t('platform.overview.created', { date: formatDateTime(org.created_at) })}</p>
        </div>
      )}
    </QueryBlock>
  )
}
