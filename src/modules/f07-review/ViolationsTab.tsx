import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { applyServerMessage } from './serverErrors'
import type { Attempt, EventRow } from './types'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'

const TONE = { serious: 'error', moderate: 'warning', minor: 'info', info: 'neutral' } as const

export function ViolationsTab({ attempt, onChanged }: { attempt: Attempt; onChanged: () => void }) {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const [snapshot, setSnapshot] = useState<{ title: string; assetId: string } | null>(null)
  const [dismissing, setDismissing] = useState<EventRow | null>(null)

  const total = attempt.timeline.length
  const sev = attempt.flag_counts.severity
  const typeText = (type: string) => (i18n.exists(`review.violations.type.${type}`) ? t(`review.violations.type.${type}`) : t('review.violations.type.unknown'))

  if (total === 0) return <p className="rounded-(--radius) border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">{t('review.violations.none')}</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{t('review.violations.summary', { count: total })}</p>
        {(['serious', 'moderate', 'minor'] as const).map((s) => (sev[s] ? <Badge key={s} tone={TONE[s]}>{t(`review.violations.${s}`, { count: sev[s] })}</Badge> : null))}
        {attempt.baseline_asset_id && (
          <Button size="sm" variant="outline" onClick={() => setSnapshot({ title: t('review.violations.baseline'), assetId: attempt.baseline_asset_id! })}>
            {t('review.violations.baseline')}
          </Button>
        )}
      </div>

      <ol className="divide-y divide-border rounded-(--radius) border border-border bg-surface shadow-card">
        {attempt.timeline.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[e.severity as keyof typeof TONE] ?? 'neutral'}>{t(`review.violations.severity.${e.severity}`, { defaultValue: e.severity })}</Badge>
              <span className="font-medium">{typeText(e.type)}</span>
              <span className="text-muted">{formatDateTime(e.occurred_at, tz)}</span>
              {e.duration_ms ? <span className="text-muted">{t('review.violations.duration', { seconds: Math.round(e.duration_ms / 1000) })}</span> : null}
              {e.dismissed && <Badge>{t('review.violations.dismissed')}</Badge>}
            </div>
            <div className="flex gap-2">
              {e.snapshot_asset_id && (
                <Button size="sm" variant="ghost" onClick={() => setSnapshot({ title: typeText(e.type), assetId: e.snapshot_asset_id! })}>
                  {t('review.violations.viewSnapshot')}
                </Button>
              )}
              {!e.dismissed && (
                <Button size="sm" variant="outline" onClick={() => setDismissing(e)}>
                  {t('review.violations.dismiss')}
                </Button>
              )}
            </div>
            {e.dismissed && e.dismissed_note && <p className="w-full text-xs text-muted">{e.dismissed_note}</p>}
          </li>
        ))}
      </ol>

      {snapshot && <SnapshotModal attemptId={attempt.id} {...snapshot} onClose={() => setSnapshot(null)} />}
      {dismissing && <DismissModal attemptId={attempt.id} event={dismissing} onClose={() => setDismissing(null)} onDone={onChanged} />}
    </div>
  )
}

/** Snapshots arrive as short-lived signed URLs: fetch on open and use as returned, never build or cache (spec 8.5). */
function SnapshotModal({ attemptId, assetId, title, onClose }: { attemptId: string; assetId: string; title: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useMutation({
    mutationFn: () => api.get<{ url: string }>(`/api/v1/attempts/${attemptId}/snapshots/${assetId}/url`),
    onSuccess: (d) => setUrl(d.url),
    onError: (e) => setError(applyServerMessage(e)),
  })
  // Fetch the signed URL once when the modal opens.
  useEffect(() => {
    load.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t('review.violations.snapshotTitle') + ': ' + title} wide>
      {!url && !error && <Spinner label={t('common.loading')} />}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {url && <img src={url} alt={t('review.violations.snapshotAlt')} className="mx-auto max-h-[70vh] rounded-(--radius)" />}
    </Modal>
  )
}

function DismissModal({ attemptId, event, onClose, onDone }: { attemptId: string; event: EventRow; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const dismiss = useMutation({
    mutationFn: () => api.post(`/api/v1/attempts/${attemptId}/events/${event.id}/dismiss`, { note: note.trim() }),
    onSuccess: () => {
      toast.success(t('review.toast.dismissed'))
      onClose()
      onDone()
    },
    onError: (e) => setError(applyServerMessage(e)),
  })
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t('review.violations.dismissTitle')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          dismiss.mutate()
        }}
      >
        <Textarea label={t('review.violations.dismissNote')} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={dismiss.isPending} disabled={note.trim().length === 0}>{t('review.violations.dismissSubmit')}</Button>
        </div>
      </form>
    </Modal>
  )
}
