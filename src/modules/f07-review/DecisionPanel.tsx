import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import type { Attempt, Decision } from './types'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'

interface Props {
  attempt: Attempt
  onChanged: () => void
}

/**
 * Approve / reject once (spec F7, F-13). The backend only lets the role owner or an org admin open this page,
 * so anyone who reaches it may decide while the decision is `waiting`; the server still enforces ownership.
 * Once decided, only an org admin can override, with a reason.
 */
export function DecisionPanel({ attempt, onChanged }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const { me, role } = useAuth()
  const tz = me?.organization?.timezone
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<'approved' | 'rejected' | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideTo, setOverrideTo] = useState<Decision>('approved')
  const [reason, setReason] = useState('')

  const decided = attempt.decision !== 'waiting'
  const canDecide = attempt.status === 'submitted' && !decided
  const last = attempt.decision_history.at(-1)

  const onError = (error: unknown) => {
    toast.error(error)
    if (error instanceof ApiError && error.is('DECISION_ALREADY_MADE')) onChanged()
  }

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      api.post(`/api/v1/attempts/${attempt.id}/decision`, { decision, note: note.trim() || null }),
    onSuccess: () => {
      toast.success(t('review.toast.decided'))
      setPending(null)
      setNote('')
      onChanged()
    },
    onError: (e) => {
      setPending(null)
      onError(e)
    },
  })

  const override = useMutation({
    mutationFn: () => api.post(`/api/v1/attempts/${attempt.id}/decision/override`, { decision: overrideTo, reason: reason.trim() }),
    onSuccess: () => {
      toast.success(t('review.toast.overridden'))
      setOverrideOpen(false)
      setReason('')
      onChanged()
    },
    onError,
  })

  return (
    <section className="rounded-(--radius) border border-border bg-surface p-5 shadow-card" aria-labelledby="decision-title">
      <h2 id="decision-title" className="text-sm font-semibold text-muted">
        {t('review.decision.title')}
      </h2>

      {decided ? (
        <div className="mt-3 space-y-2">
          <Badge tone={attempt.decision === 'approved' ? 'success' : 'error'}>{t(`review.decision.${attempt.decision}`)}</Badge>
          {last && <p className="text-sm text-muted">{t('review.decision.by', { when: formatDateTime(last.created_at, tz) })}</p>}
          {attempt.decision_note && <p className="text-sm">{attempt.decision_note}</p>}
          {role === 'org_admin' ? (
            <Button variant="outline" size="sm" onClick={() => setOverrideOpen(true)}>
              {t('review.decision.override')}
            </Button>
          ) : (
            <p className="text-xs text-muted">{t('review.decision.adminOnly')}</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">{t('review.decision.waiting')}</p>
          {canDecide && (
            <>
              <Textarea label={t('review.decision.note')} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => setPending('approved')}>{t('review.decision.approve')}</Button>
                <Button variant="danger" onClick={() => setPending('rejected')}>
                  {t('review.decision.reject')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={t('review.decision.confirmTitle')}
        body={pending === 'approved' ? t('review.decision.confirmApprove') : t('review.decision.confirmReject')}
        confirmLabel={pending === 'approved' ? t('review.decision.approve') : t('review.decision.reject')}
        danger={pending === 'rejected'}
        loading={decide.isPending}
        onConfirm={() => pending && decide.mutate(pending)}
      />

      <Modal open={overrideOpen} onOpenChange={setOverrideOpen} title={t('review.decision.overrideTitle')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            override.mutate()
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="override-to" className="block text-sm font-medium">
              {t('review.decision.overrideTo')}
            </label>
            <select
              id="override-to"
              className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
              value={overrideTo}
              onChange={(e) => setOverrideTo(e.target.value as Decision)}
            >
              <option value="approved">{t('review.decision.approved')}</option>
              <option value="rejected">{t('review.decision.rejected')}</option>
              <option value="waiting">{t('review.decision.waiting')}</option>
            </select>
          </div>
          <Textarea label={t('review.decision.overrideReason')} value={reason} onChange={(e) => setReason(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={override.isPending} disabled={reason.trim().length === 0}>
              {t('review.decision.overrideSubmit')}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
