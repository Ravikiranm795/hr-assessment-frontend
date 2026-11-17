import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { applyServerMessage } from './serverErrors'
import type { Attempt } from './types'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'

/** Extra time while the attempt is in progress; candidate data erase for org admins (spec F7). */
export function AttemptActions({ attempt, onChanged }: { attempt: Attempt; onChanged: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { role } = useAuth()
  const [extraOpen, setExtraOpen] = useState(false)
  const [eraseOpen, setEraseOpen] = useState(false)
  const [minutes, setMinutes] = useState('10')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const extra = useMutation({
    mutationFn: () => api.post(`/api/v1/attempts/${attempt.id}/extra-time`, { minutes: Number(minutes), reason: reason.trim() }),
    onSuccess: () => {
      toast.success(t('review.toast.extraTime'))
      setExtraOpen(false)
      setReason('')
      onChanged()
    },
    onError: (e) => setError(applyServerMessage(e)),
  })
  const erase = useMutation({
    mutationFn: () => api.delete(`/api/v1/attempts/${attempt.id}/candidate-data`),
    onSuccess: () => {
      toast.success(t('review.toast.erased'))
      setEraseOpen(false)
      onChanged()
    },
    onError: (e) => {
      setEraseOpen(false)
      toast.error(e)
    },
  })

  const canExtra = attempt.status === 'in_progress'
  const canErase = role === 'org_admin' && !attempt.candidate.erased
  if (!canExtra && !canErase) return null

  const minutesValid = Number.isInteger(Number(minutes)) && Number(minutes) > 0

  return (
    <div className="flex flex-wrap gap-2">
      {canExtra && (
        <Button variant="outline" size="sm" onClick={() => setExtraOpen(true)}>
          {t('review.extraTime.button')}
        </Button>
      )}
      {canErase && (
        <Button variant="outline" size="sm" onClick={() => setEraseOpen(true)}>
          {t('review.erase.button')}
        </Button>
      )}

      <Modal open={extraOpen} onOpenChange={setExtraOpen} title={t('review.extraTime.title')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            extra.mutate()
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="extra-min" className="block text-sm font-medium">
              {t('review.extraTime.minutes')}
            </label>
            <input
              id="extra-min"
              type="number"
              min={1}
              className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <Textarea label={t('review.extraTime.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExtraOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={extra.isPending} disabled={!minutesValid || reason.trim().length === 0}>
              {t('review.extraTime.submit')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={eraseOpen}
        onOpenChange={setEraseOpen}
        title={t('review.erase.title')}
        body={t('review.erase.body')}
        confirmLabel={t('review.erase.confirm')}
        danger
        loading={erase.isPending}
        onConfirm={() => erase.mutate()}
      />
    </div>
  )
}
