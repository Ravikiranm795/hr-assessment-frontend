import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'
import { ApiError } from '@/core/api/errors'
import { examApi } from './examApi'
import { examErrorText } from './errors'
import type { HelpReason } from './types'

const REASONS: HelpReason[] = ['no_camera', 'camera_not_working', 'extra_time', 'other']
const POLL_MS = 5000

interface HelpPanelProps {
  /** The server says a request is open (from the exam state). */
  pending: boolean
  /** Called when HR has decided, so the page can reload the state (camera exemption, extra minutes). */
  onResolved: () => void
}

/** "Having trouble? Request help": reasons, a note, and polling until HR decides inside the app. */
export function HelpPanel({ pending, onResolved }: HelpPanelProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<HelpReason>('camera_not_working')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)
  const [result, setResult] = useState<'approved' | 'declined' | null>(null)
  const waiting = (pending || created) && result === null

  useEffect(() => {
    if (!waiting) return
    let cancelled = false
    const poll = async () => {
      try {
        const { request } = await examApi.currentHelp()
        if (cancelled || !request || request.status === 'open') return
        setResult(request.status === 'approved' ? 'approved' : 'declined')
        setCreated(false)
        onResolved()
      } catch {
        // keep waiting; the next poll tries again
      }
    }
    void poll()
    const id = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [waiting, onResolved])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await examApi.createHelp(reason, note.trim())
      setCreated(true)
      setResult(null)
      setOpen(false)
      setNote('')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'HELP_REQUEST_PENDING') {
        setCreated(true)
        setOpen(false)
      } else {
        setError(examErrorText(e))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {waiting && (
        <p role="status" className="rounded-(--radius) border border-border bg-surface p-3 text-sm">
          {t('exam.help.waiting')}
        </p>
      )}
      {result && (
        <p role="status" className="rounded-(--radius) border border-border bg-surface p-3 text-sm">
          {t(result === 'approved' ? 'exam.help.approved' : 'exam.help.declined')}
        </p>
      )}
      <Button variant="ghost" size="sm" disabled={waiting} onClick={() => setOpen(true)}>
        {t('exam.help.open')}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={t('exam.help.title')} description={t('exam.help.description')}>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('exam.help.reason')}</legend>
            {REASONS.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="help-reason" checked={reason === value} onChange={() => setReason(value)} />
                {t(`exam.help.reasons.${value}`)}
              </label>
            ))}
          </fieldset>
          <Textarea label={t('exam.help.note')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('exam.help.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {t('exam.help.send')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
