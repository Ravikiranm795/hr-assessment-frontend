import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/Badge'
import { formatDateTime, formatNumber } from '@/core/utils'
import type { GadgetData } from './types'

interface Props {
  data: GadgetData
  tz?: string
}

type Rec = Record<string, unknown>
const list = (d: GadgetData, key = 'items') => (Array.isArray(d[key]) ? (d[key] as Rec[]) : [])
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Number that links to the list behind it (spec F3). There is no candidates list screen, so counts open the roles. */
function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <>
      <span className="text-2xl font-semibold">{formatNumber(value)}</span>
      <span className="text-xs text-muted">{label}</span>
    </>
  )
  const cls = 'flex flex-col rounded-(--radius) border border-border p-3'
  return to ? (
    <Link to={to} className={`${cls} hover:bg-bg`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border text-sm">{children}</ul>
}

function Empty() {
  const { t } = useTranslation()
  return <p className="py-6 text-center text-sm text-muted">{t('dashboard.gadget.empty')}</p>
}

const CHART = { primary: 'var(--color-primary)', accent: 'var(--color-accent)', muted: '#94a3b8', success: 'var(--color-success)', error: 'var(--color-error)' }

function SummaryCounts({ data }: Props) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['invited', 'in_progress', 'submitted', 'waiting'] as const).map((k) => (
        <Stat key={k} label={t(`dashboard.summary.${k}`)} value={num(data[k])} to="/roles" />
      ))}
    </div>
  )
}

function NeedsAttention({ data }: Props) {
  const { t } = useTranslation()
  const rows: [string, string][] = [
    ['unreviewed', '/roles'],
    ['expiring_links', '/roles'],
    ['flagged_attempts', '/roles'],
    ['undecided_past_retention', '/roles'],
    ['pending_help_requests', '/help-requests'],
  ]
  const active = rows.filter(([k]) => num(data[k]) > 0)
  if (active.length === 0) return <p className="py-6 text-center text-sm text-muted">{t('dashboard.attention.none')}</p>
  return (
    <Rows>
      {active.map(([k, to]) => (
        <li key={k}>
          <Link to={to} className="flex items-center justify-between py-2 hover:text-primary">
            <span>{t(`dashboard.attention.${k}`)}</span>
            <Badge tone="warning">{num(data[k])}</Badge>
          </Link>
        </li>
      ))}
    </Rows>
  )
}

function OpenRoles({ data }: Props) {
  const { t } = useTranslation()
  const items = list(data)
  if (!items.length) return <Empty />
  return (
    <Rows>
      {items.map((r) => (
        <li key={str(r.id)}>
          <Link to={`/roles/${str(r.id)}`} className="block py-2 hover:text-primary">
            <p className="font-medium">{str(r.title)}</p>
            <p className="text-xs text-muted">
              {t('dashboard.openRoles.invited', { count: num(r.invited) })} · {t('dashboard.openRoles.inProgress', { count: num(r.in_progress) })} · {t('dashboard.openRoles.submitted', { count: num(r.submitted) })}
            </p>
          </Link>
        </li>
      ))}
    </Rows>
  )
}

function RecentActivity({ data, tz }: Props) {
  const { t, i18n } = useTranslation()
  const items = list(data)
  if (!items.length) return <Empty />
  return (
    <Rows>
      {items.map((a, i) => (
        <li key={i} className="py-2">
          <p>{i18n.exists(`audit.actions.${str(a.action)}`) ? t(`audit.actions.${str(a.action)}`) : str(a.action)}</p>
          <p className="text-xs text-muted">
            {str(a.actor)} · {formatDateTime(str(a.created_at), tz)}
          </p>
        </li>
      ))}
    </Rows>
  )
}

function CandidatesPerWeek({ data }: Props) {
  const { t } = useTranslation()
  const items = list(data).map((w) => ({ week: str(w.week).slice(5), candidates: num(w.candidates), full: str(w.week) }))
  if (!items.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={items} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => t('dashboard.candidates', { count: Number(v) })} labelFormatter={(_, p) => t('dashboard.week', { date: p?.[0]?.payload?.full })} />
        <Bar dataKey="candidates" fill={CHART.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DecisionSplit({ data }: Props) {
  const { t } = useTranslation()
  const slices = (['approved', 'rejected', 'waiting'] as const).map((k) => ({ key: k, name: t(`dashboard.decision.${k}`), value: num(data[k]) }))
  const fill = { approved: CHART.success, rejected: CHART.error, waiting: CHART.muted }
  if (slices.every((s) => s.value === 0)) return <Empty />
  return (
    <div className="flex h-full items-center gap-4">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
              {slices.map((s) => (
                <Cell key={s.key} fill={fill[s.key]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm" style={{ background: fill[s.key] }} />
            {s.name}: <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

const QUICK_TO: Record<string, string> = { create_role: '/roles', create_assessment: '/assessments', invite_candidate: '/roles' }
function QuickActions({ data }: Props) {
  const { t, i18n } = useTranslation()
  const items = list(data)
  if (!items.length) return <Empty />
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={str(a.key)}>
          <Link to={QUICK_TO[str(a.key)] ?? '/'} className="block rounded-(--radius) border border-border px-3 py-2 text-sm font-medium hover:bg-bg">
            {i18n.exists(`dashboard.quick.${str(a.key)}`) ? t(`dashboard.quick.${str(a.key)}`) : str(a.key)}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ExpiringInvites({ data, tz }: Props) {
  const { t } = useTranslation()
  const items = list(data)
  if (!items.length) return <Empty />
  return (
    <Rows>
      {items.map((i) => (
        <li key={str(i.invite_id)} className="py-2">
          <p className="font-medium">{str(i.candidate_name)}</p>
          <p className="text-xs text-muted">
            {str(i.role_title)} · {t('dashboard.expiresAt', { when: formatDateTime(str(i.expires_at), tz) })}
          </p>
        </li>
      ))}
    </Rows>
  )
}

function BarList({ data, valueKey, label }: { data: GadgetData; valueKey: string; label: (r: Rec) => string }) {
  const items = list(data).map((r) => ({ title: str(r.title), value: num(r[valueKey]), r }))
  if (!items.length) return <Empty />
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={str(i.r.role_id)} className="text-sm">
          <div className="flex justify-between gap-2">
            <Link to={`/roles/${str(i.r.role_id)}`} className="truncate font-medium hover:text-primary">
              {i.title}
            </Link>
            <span className="shrink-0 text-xs text-muted">{label(i.r)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
            <div className="h-full" style={{ width: `${(i.value / max) * 100}%`, background: CHART.primary }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function AvgScore({ data }: Props) {
  const { t } = useTranslation()
  return <BarList data={data} valueKey="avg_score_percent" label={(r) => t('dashboard.scoreOf', { score: Math.round(num(r.avg_score_percent)), count: num(r.attempts) })} />
}
function AvgTime({ data }: Props) {
  const { t } = useTranslation()
  return <BarList data={data} valueKey="avg_minutes" label={(r) => t('dashboard.minutesOf', { minutes: num(r.avg_minutes).toFixed(1), count: num(r.attempts) })} />
}

function MyAssessments({ data }: Props) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['assessments', 'draft_versions', 'published_versions', 'versions_in_use'] as const).map((k) => (
        <Stat key={k} label={t(`dashboard.mine.${k}`)} value={num(data[k])} to="/assessments" />
      ))}
    </div>
  )
}

function ProctoringFlags({ data, tz }: Props) {
  const { t } = useTranslation()
  const items = list(data)
  if (!items.length) return <Empty />
  return (
    <Rows>
      {items.map((a) => {
        const sev = (a.flag_counts as { severity?: Record<string, number> } | undefined)?.severity ?? {}
        const total = Object.values(sev).reduce((s, n) => s + n, 0)
        return (
          <li key={str(a.attempt_id)}>
            <Link to={`/attempts/${str(a.attempt_id)}`} className="block py-2 hover:text-primary">
              <p className="flex items-center justify-between gap-2 font-medium">
                {str(a.candidate_name)}
                <Badge tone={sev.serious ? 'error' : 'warning'}>{t('dashboard.flags', { count: total })}</Badge>
              </p>
              <p className="text-xs text-muted">
                {str(a.role_title)} · {formatDateTime(str(a.submitted_at), tz)}
              </p>
            </Link>
          </li>
        )
      })}
    </Rows>
  )
}

function RolesByRecruiter({ data }: Props) {
  const { t } = useTranslation()
  const items = list(data)
  if (!items.length) return <Empty />
  return (
    <Rows>
      {items.map((r) => (
        <li key={str(r.user_id)} className="flex items-center justify-between py-2">
          <span className="font-medium">{str(r.name)}</span>
          <span className="text-xs text-muted">{t('dashboard.recruiter', { open: num(r.open_roles), total: num(r.total_roles) })}</span>
        </li>
      ))}
    </Rows>
  )
}

function SecurityEvents({ data, tz }: Props) {
  const { t, i18n } = useTranslation()
  const counts = Object.entries((data.last_7_days ?? {}) as Record<string, number>)
  const latest = list(data, 'latest')
  const label = (a: string) => (i18n.exists(`audit.actions.${a}`) ? t(`audit.actions.${a}`) : a)
  if (!counts.length && !latest.length) return <p className="py-6 text-center text-sm text-muted">{t('dashboard.security.none')}</p>
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted">{t('dashboard.security.last7')}</span>
        {counts.map(([a, n]) => (
          <Badge key={a} tone="warning">
            {label(a)}: {n}
          </Badge>
        ))}
      </div>
      <Rows>
        {latest.map((e, i) => (
          <li key={i} className="py-2">
            <p>{label(str(e.action))}</p>
            <p className="text-xs text-muted">
              {str(e.actor)} · {formatDateTime(str(e.created_at), tz)}
            </p>
          </li>
        ))}
      </Rows>
    </div>
  )
}

function ActiveNotice({ data }: Props) {
  const { t } = useTranslation()
  const items = list(data)
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{t('dashboard.notice.none')}</p>
  return (
    <ul className="space-y-2 text-sm">
      {items.map((n, i) => (
        <li key={i} className="rounded-(--radius) border border-warning/30 bg-warning/10 p-3">
          {str(n.comment) || str(n.message) || JSON.stringify(n)}
        </li>
      ))}
    </ul>
  )
}

function OrgsOverview({ data }: Props) {
  const { t } = useTranslation()
  const items = list(data)
  if (!items.length) return <Empty />
  return (
    <Rows>
      {items.map((o) => (
        <li key={str(o.id)}>
          <Link to={`/platform/orgs/${str(o.id)}/overview`} className="flex items-center justify-between gap-2 py-2 hover:text-primary">
            <span>
              <span className="block font-medium">{str(o.name)}</span>
              <span className="text-xs text-muted">{t('dashboard.platform.orgOverview', { users: num(o.active_users), roles: num(o.open_roles) })}</span>
            </span>
            <Badge tone={o.status === 'active' ? 'success' : 'neutral'}>{str(o.status)}</Badge>
          </Link>
        </li>
      ))}
    </Rows>
  )
}

function ActiveMisuse({ data }: Props) {
  const { t } = useTranslation()
  const items = list(data)
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{t('dashboard.platform.noFlags')}</p>
  return (
    <Rows>
      {items.map((f, i) => (
        <li key={i} className="py-2">
          <p className="font-medium">{str(f.org_name) || str(f.org_id)}</p>
          <p className="text-xs text-muted">{str(f.comment)}</p>
        </li>
      ))}
    </Rows>
  )
}

function PlatformUsage({ data }: Props) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['ai_calls_this_month', 'active_orgs', 'active_users', 'attempts_this_month'] as const).map((k) => (
        <Stat key={k} label={t(`dashboard.platform.${k}`)} value={num(data[k])} />
      ))}
    </div>
  )
}

export const GADGETS: Record<string, (p: Props) => ReactNode> = {
  // Each entry is a component: render with JSX, never call it directly.
  summary_counts: SummaryCounts,
  needs_attention: NeedsAttention,
  open_roles: OpenRoles,
  recent_activity: RecentActivity,
  candidates_per_week: CandidatesPerWeek,
  decision_split: DecisionSplit,
  quick_actions: QuickActions,
  expiring_invites: ExpiringInvites,
  avg_score_by_role: AvgScore,
  avg_completion_time: AvgTime,
  my_assessments: MyAssessments,
  proctoring_flags: ProctoringFlags,
  roles_by_recruiter: RolesByRecruiter,
  security_events: SecurityEvents,
  active_flag_notice: ActiveNotice,
  orgs_overview: OrgsOverview,
  active_misuse_flags: ActiveMisuse,
  platform_usage: PlatformUsage,
}
