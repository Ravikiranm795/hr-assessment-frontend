import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { AssessmentPicker } from './AssessmentPicker'
import { BulkInviteDialog } from './BulkInviteDialog'
import { ExamUrlDialog } from './ExamUrlDialog'
import { HelpRequestPanel } from './HelpRequestPanel'
import { InviteActions } from './InviteActions'
import { InviteDialog } from './InviteDialog'
import { ReassignDialog } from './ReassignDialog'
import { RoleFormDialog } from './RoleFormDialog'
import { roleKeys, useInvites, useOpenHelpRequests, useRole } from './api'
import { isFullInvite, type InviteListItem, type RoleDetail } from './types'
import { Badge, Banner, SelectField } from './ui'

type Transition = 'open' | 'close' | 'reopen'

const STATUS_FILTERS = ['invited', 'started', 'submitted', 'expired', 'revoked']

export function RoleDetailPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const { me, role: myRole, hasFlag } = useAuth()
  const roleQuery = useRole(id)

  if (roleQuery.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState error={roleQuery.error} onRetry={() => void roleQuery.refetch()} />
      </div>
    )
  }
  if (!roleQuery.data) return <Spinner label={t('common.loading')} className="py-16" />

  const role = roleQuery.data
  const isManager = myRole === 'org_admin' || role.owner_id === me?.user.id
  return (
    <RoleDetailBody
      role={role}
      isManager={isManager}
      isAdmin={myRole === 'org_admin'}
      canInvite={hasFlag('invites') && isManager}
      canBulk={hasFlag('csv_bulk_invite')}
      canEmail={hasFlag('email_sending')}
      canHelp={hasFlag('help_requests') && isManager}
    />
  )
}

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link to="/roles" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft className="size-4" aria-hidden />
      {t('roles.detail.back')}
    </Link>
  )
}

interface BodyProps {
  role: RoleDetail
  isManager: boolean
  isAdmin: boolean
  canInvite: boolean
  canBulk: boolean
  canEmail: boolean
  canHelp: boolean
}

function RoleDetailBody({ role, isManager, isAdmin, canInvite, canBulk, canEmail, canHelp }: BodyProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const toast = useToast()
  const { me } = useAuth()
  const tz = me?.organization.timezone
  const [editing, setEditing] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [url, setUrl] = useState<{ url: string; emailSent: boolean } | null>(null)
  const [state, setState] = useState<ListState>({ page: 1, pageSize: 20 })
  const [status, setStatus] = useState('')

  const invites = useInvites(role.id, state.page, state.pageSize, status)
  const help = useOpenHelpRequests(canHelp)
  const pending = useMemo(() => (help.data?.items ?? []).filter((r) => r.role_id === role.id), [help.data, role.id])

  const transition = useMutation({
    mutationFn: (kind: Transition) => api.post(`/api/v1/roles/${role.id}/${kind}`),
    onSuccess: (_data, kind) => {
      void client.invalidateQueries({ queryKey: roleKeys.all })
      setConfirmClose(false)
      toast.success(t(`roles.detail.done.${kind}`))
    },
    onError: (error) => {
      setConfirmClose(false)
      toast.error(error)
    },
  })

  const blocked =
    role.status !== 'open' ? t('roles.invite.blocked.notOpen') : !role.assessment ? t('roles.invite.blocked.noAssessment') : null

  const columns: Column<InviteListItem>[] = isManager
    ? [
        {
          key: 'name',
          header: t('roles.candidates.name'),
          cell: (row) => {
            const full = isFullInvite(row) ? row : null
            const name = full?.attempt ? (
              <Link
                to={`/attempts/${full.attempt.id}`}
                className="font-medium text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.candidate_name}
              </Link>
            ) : (
              <span className="font-medium">{row.candidate_name}</span>
            )
            return (
              <div>
                {name}
                {full?.candidate_email && <div className="text-xs text-muted">{full.candidate_email}</div>}
              </div>
            )
          },
        },
        { key: 'status', header: t('roles.candidates.status'), cell: (row) => <Badge value={row.status} label={statusLabel(t, row.status)} /> },
        {
          key: 'score',
          header: t('roles.candidates.score'),
          cell: (row) => {
            const score = isFullInvite(row) ? row.attempt?.score_percent : null
            return score == null ? '—' : `${score}%`
          },
        },
        {
          key: 'flags',
          header: t('roles.candidates.flags'),
          cell: (row) => {
            const counts = isFullInvite(row) ? row.attempt?.flag_counts : null
            if (!counts) return '—'
            return Object.values(counts).reduce<number>((sum, n) => sum + (typeof n === 'number' ? n : 0), 0)
          },
        },
        { key: 'decision', header: t('roles.candidates.decision'), cell: (row) => <DecisionBadge row={row} /> },
        {
          key: 'expires',
          header: t('roles.candidates.expires'),
          cell: (row) => (isFullInvite(row) ? formatDateTime(row.expires_at, tz) : '—'),
        },
        {
          key: 'actions',
          header: t('common.actions'),
          cell: (row) =>
            isFullInvite(row) && canInvite ? (
              <div onClick={(e) => e.stopPropagation()}>
                <InviteActions invite={row} canEmail={canEmail} onUrl={(u) => setUrl({ url: u, emailSent: false })} />
              </div>
            ) : null,
        },
      ]
    : [
        { key: 'name', header: t('roles.candidates.name'), cell: (row) => <span className="font-medium">{row.candidate_name}</span> },
        { key: 'status', header: t('roles.candidates.status'), cell: (row) => <Badge value={row.status} label={statusLabel(t, row.status)} /> },
        { key: 'decision', header: t('roles.candidates.decision'), cell: (row) => <DecisionBadge row={row} /> },
      ]

  const owner = role.owner_name ?? '—'

  return (
    <div className="space-y-8">
      <BackLink />

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{role.title}</h1>
              <Badge value={role.status} label={t(`roles.status.${role.status}`, { defaultValue: role.status })} />
            </div>
            <p className="text-sm text-muted">
              {[role.department, role.experience_level, t('roles.detail.vacancies', { count: role.vacancies })].filter(Boolean).join(' · ')}
            </p>
            <p className="text-sm">
              {t('roles.detail.owner')}: <span className="font-medium">{owner}</span>
              {role.owner_inactive && <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">{t('roles.list.ownerInactive')}</span>}
            </p>
            {role.description && <p className="max-w-3xl text-sm text-muted">{role.description}</p>}
          </div>
          {isManager && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t('roles.detail.edit')}
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => setReassigning(true)}>
                  {t('roles.detail.reassign')}
                </Button>
              )}
              {role.status === 'draft' && (
                <Button loading={transition.isPending && transition.variables === 'open'} onClick={() => transition.mutate('open')}>
                  {t('roles.detail.open')}
                </Button>
              )}
              {role.status === 'open' && (
                <Button variant="danger" onClick={() => setConfirmClose(true)}>
                  {t('roles.detail.close')}
                </Button>
              )}
              {role.status === 'closed' && (
                <Button loading={transition.isPending && transition.variables === 'reopen'} onClick={() => transition.mutate('reopen')}>
                  {t('roles.detail.reopen')}
                </Button>
              )}
            </div>
          )}
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {Object.entries(role.progress.invites).map(([key, count]) => (
            <div key={key} className="flex gap-2">
              <dt className="text-muted">{statusLabel(t, key)}</dt>
              <dd className="font-medium">{count}</dd>
            </div>
          ))}
          {Object.entries(role.progress.decisions).map(([key, count]) => (
            <div key={`d-${key}`} className="flex gap-2">
              <dt className="text-muted">{decisionLabel(t, key)}</dt>
              <dd className="font-medium">{count}</dd>
            </div>
          ))}
        </dl>
      </header>

      {canHelp && <HelpRequestPanel requests={pending} />}

      <section aria-labelledby="role-assessment-heading" className="space-y-3">
        <h2 id="role-assessment-heading" className="text-lg font-semibold">
          {t('roles.assessment.title')}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-(--radius) border border-border bg-surface p-4 shadow-card">
          {role.assessment ? (
            <div className="text-sm">
              <p className="font-medium">{role.assessment.assessment_title}</p>
              <p className="text-muted">
                {t('roles.assessment.version', { version: role.assessment.version_no })} ·{' '}
                {t('roles.assessment.linkedAt', { date: formatDateTime(role.assessment.linked_at, tz) })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">{t('roles.assessment.notLinked')}</p>
          )}
          {isManager && (
            <Button variant="outline" onClick={() => setPicking(true)}>
              {role.assessment ? t('roles.assessment.replace') : t('roles.assessment.link')}
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="role-candidates-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="role-candidates-heading" className="text-lg font-semibold">
            {t('roles.candidates.title')}
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-44">
              <SelectField
                label={t('roles.candidates.filterStatus')}
                hideLabel
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setState({ ...state, page: 1 })
                }}
              >
                <option value="">{t('roles.candidates.allStatuses')}</option>
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(t, s)}
                  </option>
                ))}
              </SelectField>
            </div>
            {canInvite && (
              <>
                <Button disabled={blocked !== null} onClick={() => setInviting(true)}>
                  {t('roles.invite.open')}
                </Button>
                {canBulk && (
                  <Button variant="outline" disabled={blocked !== null} onClick={() => setBulk(true)}>
                    {t('roles.bulk.open')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {canInvite && blocked && <Banner kind="info">{blocked}</Banner>}
        {!isManager && <p className="text-sm text-muted">{t('roles.candidates.limited')}</p>}

        <DataTable
          columns={columns}
          rows={invites.data?.items}
          total={invites.data?.total ?? 0}
          state={state}
          onState={setState}
          rowKey={(row) => row.id}
          loading={invites.isFetching}
          error={invites.error}
          onRetry={() => void invites.refetch()}
          emptyTitle={t('roles.candidates.emptyTitle')}
          emptyBody={t('roles.candidates.emptyBody')}
          onRowClick={
            isManager
              ? (row) => {
                  if (isFullInvite(row) && row.attempt) navigate(`/attempts/${row.attempt.id}`)
                }
              : undefined
          }
        />
      </section>

      <RoleFormDialog open={editing} onOpenChange={setEditing} role={role} onSaved={() => setEditing(false)} />
      {isAdmin && <ReassignDialog open={reassigning} onOpenChange={setReassigning} role={role} />}
      <AssessmentPicker open={picking} onOpenChange={setPicking} roleId={role.id} linkedVersionId={role.linked_version_id} />
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t('roles.detail.closeTitle')}
        body={t('roles.detail.closeBody')}
        confirmLabel={t('roles.detail.close')}
        danger
        loading={transition.isPending}
        onConfirm={() => transition.mutate('close')}
      />
      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        roleId={role.id}
        canEmail={canEmail}
        onCreated={(result) => {
          setInviting(false)
          setUrl({ url: result.exam_url, emailSent: result.email_sent })
        }}
      />
      <BulkInviteDialog open={bulk} onOpenChange={setBulk} roleId={role.id} />
      <ExamUrlDialog url={url?.url ?? null} emailSent={url?.emailSent} onClose={() => setUrl(null)} />
    </div>
  )
}

function DecisionBadge({ row }: { row: InviteListItem }) {
  const { t } = useTranslation()
  const decision = isFullInvite(row) ? row.attempt?.decision : row.decision
  if (!decision) return <>—</>
  return <Badge value={decision} label={decisionLabel(t, decision)} />
}

type T = (key: string, options?: Record<string, unknown>) => string
const statusLabel = (t: T, value: string) => t(`roles.invite.status.${value}`, { defaultValue: value })
const decisionLabel = (t: T, value: string) => t(`roles.decision.${value}`, { defaultValue: value })
