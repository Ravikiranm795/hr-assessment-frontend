import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import type { HelpRequest } from './types'

export type Mode = 'approve' | 'decline'

interface Props {
  request: HelpRequest
  mode: Mode
  onClose: () => void
}

/** Approve (optionally grant camera exemption and extra minutes) or decline (note required). */
export function DecisionModal({ request, mode, onClose }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const toast = useToast()
  const [camera, setCamera] = useState(request.reason === 'no_camera' || request.reason === 'camera_not_working')
  const [minutes, setMinutes] = useState('0')
  const [note, setNote] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | undefined>()

  const decide = useMutation({
    mutationFn: () =>
      mode === 'approve'
        ? api.post(`/api/v1/help-requests/${request.id}/approve`, {
            camera_exempt: camera,
            extra_minutes: Number(minutes) || 0,
            note: note.trim() || null,
          })
        : api.post(`/api/v1/help-requests/${request.id}/decline`, { note: note.trim() }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['inbox'] })
      toast.success(mode === 'approve' ? t('inbox.approved') : t('inbox.declined'))
      onClose()
    },
    onError: (error) => setBanner(errorText(error)),
  })

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={mode === 'approve' ? t('inbox.approveTitle') : t('inbox.declineTitle')}
      description={`${request.candidate_name} · ${request.role_title}`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setBanner(null)
          if (mode === 'decline' && !note.trim()) return setNoteError(t('fieldErrors.required'))
          setNoteError(undefined)
          decide.mutate()
        }}
      >
        {banner && (
          <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
            {banner}
          </p>
        )}
        {mode === 'approve' && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={camera} onChange={(e) => setCamera(e.target.checked)} />
              {t('inbox.cameraExempt')}
            </label>
            <div className="space-y-1.5">
              <label htmlFor="inbox-minutes" className="block text-sm font-medium">
                {t('inbox.extraMinutes')}
              </label>
              <input
                id="inbox-minutes"
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
              />
            </div>
          </>
        )}
        <Textarea
          label={mode === 'decline' ? t('inbox.noteRequired') : t('inbox.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={noteError}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant={mode === 'decline' ? 'danger' : 'primary'} loading={decide.isPending}>
            {mode === 'approve' ? t('inbox.approve') : t('inbox.decline')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
