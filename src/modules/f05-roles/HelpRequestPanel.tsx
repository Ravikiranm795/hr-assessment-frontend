import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { roleKeys } from './api'
import type { HelpRequest } from './types'
import { Banner, Dialog, TextAreaField } from './ui'

type Mode = 'approve' | 'decline'

/** Pending help requests of this role, shown at the top of the role page with approve and decline. */
export function HelpRequestPanel({ requests }: { requests: HelpRequest[] }) {
  const { t } = useTranslation()
  const { me } = useAuth()
  const client = useQueryClient()
  const toast = useToast()
  const [active, setActive] = useState<{ request: HelpRequest; mode: Mode } | null>(null)
  const [camera, setCamera] = useState(false)
  const [minutes, setMinutes] = useState('0')
  const [note, setNote] = useState('')
  const [banner, setBanner] = useState<string | null>(null)

  const decide = useMutation({
    mutationFn: ({ request, mode }: { request: HelpRequest; mode: Mode }) =>
      mode === 'approve'
        ? api.post(`/api/v1/help-requests/${request.id}/approve`, {
            camera_exempt: camera,
            extra_minutes: Number(minutes) || 0,
            note: note.trim() || null,
          })
        : api.post(`/api/v1/help-requests/${request.id}/decline`, { note: note.trim() }),
    onSuccess: (_data, { mode }) => {
      void client.invalidateQueries({ queryKey: roleKeys.all })
      toast.success(mode === 'approve' ? t('roles.help.approved') : t('roles.help.declined'))
      close()
    },
    onError: (error) => setBanner(errorText(error)),
  })

  function open(request: HelpRequest, mode: Mode) {
    setCamera(request.reason === 'no_camera' || request.reason === 'camera_not_working')
    setMinutes('0')
    setNote('')
    setBanner(null)
    setActive({ request, mode })
  }
  function close() {
    setActive(null)
    setBanner(null)
  }

  if (requests.length === 0) return null

  return (
    <section aria-labelledby="role-help-heading" className="space-y-3">
      <h2 id="role-help-heading" className="text-lg font-semibold">
        {t('roles.help.title', { count: requests.length })}
      </h2>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-warning/40 bg-warning/10 p-4">
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {r.candidate_name} · {t(`roles.help.reason.${r.reason}`, { defaultValue: r.reason })}
              </p>
              {r.note && <p className="mt-1 text-muted">{r.note}</p>}
              <p className="mt-1 text-xs text-muted">{formatDateTime(r.created_at, me?.organization.timezone)}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => open(r, 'approve')}>
                {t('roles.help.approve')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => open(r, 'decline')}>
                {t('roles.help.decline')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={active !== null}
        onOpenChange={(next) => !next && close()}
        title={active?.mode === 'approve' ? t('roles.help.approveTitle') : t('roles.help.declineTitle')}
        description={active ? `${active.request.candidate_name} · ${active.request.role_title}` : undefined}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!active) return
            if (active.mode === 'decline' && !note.trim()) return setBanner(t('fieldErrors.required'))
            decide.mutate(active)
          }}
        >
          {banner && <Banner kind="error">{banner}</Banner>}
          {active?.mode === 'approve' && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={camera} onChange={(e) => setCamera(e.target.checked)} />
                {t('roles.help.cameraExempt')}
              </label>
              <div className="space-y-1.5">
                <label htmlFor="help-minutes" className="block text-sm font-medium">
                  {t('roles.help.extraMinutes')}
                </label>
                <input
                  id="help-minutes"
                  type="number"
                  min={0}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
                />
              </div>
            </>
          )}
          <TextAreaField
            label={active?.mode === 'decline' ? t('roles.help.noteRequired') : t('roles.help.note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant={active?.mode === 'decline' ? 'danger' : 'primary'} loading={decide.isPending}>
              {active?.mode === 'approve' ? t('roles.help.approve') : t('roles.help.decline')}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  )
}
