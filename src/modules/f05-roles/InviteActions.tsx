import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { roleKeys } from './api'
import type { InviteDetail, InviteRow } from './types'
import { Banner, Dialog, SelectField, TextAreaField } from './ui'

type Action = 'extend' | 'regenerate' | 'reset' | 'revoke' | 'accommodations'

interface Props {
  invite: InviteRow
  canEmail: boolean
  onUrl: (url: string) => void
}

const item = 'cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-bg'
const EXTEND_HOURS = [24, 48, 72, 168, 336, 720]

/** Which actions the backend accepts per invite status (unstarted only for regenerate and revoke). */
function allowed(status: string, canEmail: boolean) {
  const list: (Action | 'email')[] = []
  if (status === 'invited') list.push('extend', 'regenerate', 'reset', 'revoke', 'accommodations')
  if (status === 'started') list.push('reset', 'accommodations')
  if (status === 'expired') list.push('extend')
  if (status === 'invited' && canEmail) list.push('email')
  return list
}

export function InviteActions({ invite, canEmail, onUrl }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const toast = useToast()
  const [action, setAction] = useState<Action | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [hours, setHours] = useState('72')
  const [reason, setReason] = useState('')

  const done = (message?: string) => {
    void client.invalidateQueries({ queryKey: roleKeys.all })
    if (message) toast.success(message)
    close()
  }
  function close() {
    setAction(null)
    setBanner(null)
    setReason('')
  }

  const regenerate = useMutation({
    mutationFn: () => api.post<{ exam_url: string }>(`/api/v1/invites/${invite.id}/regenerate-link`),
    onSuccess: (data) => {
      done()
      onUrl(data.exam_url)
    },
    onError: (error) => setBanner(errorText(error)),
  })
  const revoke = useMutation({
    mutationFn: () => api.post(`/api/v1/invites/${invite.id}/revoke`),
    onSuccess: () => done(t('roles.actions.revoked')),
    onError: (error) => setBanner(errorText(error)),
  })
  const extend = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/invites/${invite.id}/extend`, {
        expires_at: new Date(Date.now() + Number(hours) * 3_600_000).toISOString(),
        reason: reason.trim(),
      }),
    onSuccess: () => done(t('roles.actions.extended')),
    onError: (error) => setBanner(errorText(error)),
  })
  const reset = useMutation({
    mutationFn: () => api.post(`/api/v1/invites/${invite.id}/reset-binding`, { reason: reason.trim() }),
    onSuccess: () => done(t('roles.actions.bindingReset')),
    onError: (error) => setBanner(errorText(error)),
  })
  const email = useMutation({
    mutationFn: () => api.post(`/api/v1/invites/${invite.id}/send-email`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: roleKeys.all })
      toast.success(t('roles.actions.emailSent'))
    },
    onError: (error) => toast.error(error),
  })

  const options = allowed(invite.status, canEmail)
  if (options.length === 0) return <span className="text-muted">{t('roles.actions.none')}</span>

  const needReason = (submit: () => void) => (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setBanner(t('fieldErrors.required'))
    setBanner(null)
    submit()
  }

  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <Button size="sm" variant="outline" aria-label={t('roles.actions.for', { name: invite.candidate_name })}>
            <MoreHorizontal className="size-4" aria-hidden />
            {t('common.actions')}
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={4} className="z-40 min-w-52 rounded-(--radius) border border-border bg-surface p-1 shadow-card">
            {options.includes('extend') && (
              <Dropdown.Item className={item} onSelect={() => setAction('extend')}>
                {t('roles.actions.extend')}
              </Dropdown.Item>
            )}
            {options.includes('regenerate') && (
              <Dropdown.Item className={item} onSelect={() => setAction('regenerate')}>
                {t('roles.actions.regenerate')}
              </Dropdown.Item>
            )}
            {options.includes('email') && (
              <Dropdown.Item className={item} onSelect={() => email.mutate()}>
                {t('roles.actions.sendEmail')}
              </Dropdown.Item>
            )}
            {options.includes('reset') && (
              <Dropdown.Item className={item} onSelect={() => setAction('reset')}>
                {t('roles.actions.resetBinding')}
              </Dropdown.Item>
            )}
            {options.includes('accommodations') && (
              <Dropdown.Item className={item} onSelect={() => setAction('accommodations')}>
                {t('roles.actions.accommodations')}
              </Dropdown.Item>
            )}
            {options.includes('revoke') && (
              <Dropdown.Item className={`${item} text-error`} onSelect={() => setAction('revoke')}>
                {t('roles.actions.revoke')}
              </Dropdown.Item>
            )}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>

      <Dialog
        open={action === 'extend'}
        onOpenChange={(next) => !next && close()}
        title={t('roles.actions.extendTitle')}
        description={t('roles.actions.extendBody', { name: invite.candidate_name })}
      >
        <form className="space-y-4" onSubmit={needReason(() => extend.mutate())}>
          {banner && <Banner kind="error">{banner}</Banner>}
          <SelectField label={t('roles.actions.extendFor')} value={hours} onChange={(e) => setHours(e.target.value)}>
            {EXTEND_HOURS.map((h) => (
              <option key={h} value={h}>
                {h % 24 === 0 ? t('roles.actions.days', { count: h / 24 }) : t('roles.actions.hours', { count: h })}
              </option>
            ))}
          </SelectField>
          <TextAreaField label={t('roles.actions.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={extend.isPending}>
              {t('roles.actions.extend')}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={action === 'reset'}
        onOpenChange={(next) => !next && close()}
        title={t('roles.actions.resetTitle')}
        description={t('roles.actions.resetBody', { name: invite.candidate_name })}
      >
        <form className="space-y-4" onSubmit={needReason(() => reset.mutate())}>
          {banner && <Banner kind="error">{banner}</Banner>}
          <TextAreaField label={t('roles.actions.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={reset.isPending}>
              {t('roles.actions.resetBinding')}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={action === 'regenerate'}
        onOpenChange={(next) => !next && close()}
        title={t('roles.actions.regenerateTitle')}
        body={<>{banner ?? t('roles.actions.regenerateBody', { name: invite.candidate_name })}</>}
        confirmLabel={t('roles.actions.regenerate')}
        loading={regenerate.isPending}
        onConfirm={() => regenerate.mutate()}
      />
      <ConfirmDialog
        open={action === 'revoke'}
        onOpenChange={(next) => !next && close()}
        title={t('roles.actions.revokeTitle')}
        body={<>{banner ?? t('roles.actions.revokeBody', { name: invite.candidate_name })}</>}
        confirmLabel={t('roles.actions.revoke')}
        danger
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />

      <Dialog
        open={action === 'accommodations'}
        onOpenChange={(next) => !next && close()}
        title={t('roles.actions.accommodationsTitle')}
        description={t('roles.actions.accommodationsBody', { name: invite.candidate_name })}
      >
        {action === 'accommodations' && <AccommodationsForm inviteId={invite.id} onClose={close} onSaved={() => done(t('roles.actions.accommodationsSaved'))} />}
      </Dialog>
    </>
  )
}

function AccommodationsForm({ inviteId, onClose, onSaved }: { inviteId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const detail = useQuery({ queryKey: ['roles', 'invite', inviteId], queryFn: () => api.get<InviteDetail>(`/api/v1/invites/${inviteId}`) })
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
  if (!detail.data) return <Spinner label={t('common.loading')} className="py-6" />
  return <AccommodationsFields invite={detail.data} onClose={onClose} onSaved={onSaved} />
}

function AccommodationsFields({ invite, onClose, onSaved }: { invite: InviteDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [camera, setCamera] = useState(invite.camera_exempt)
  const [multiplier, setMultiplier] = useState(String(invite.time_multiplier))
  const [minutes, setMinutes] = useState(String(invite.extra_minutes))
  const [reason, setReason] = useState(invite.accommodation_reason ?? '')
  const [banner, setBanner] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/invites/${invite.id}/accommodations`, {
        camera_exempt: camera,
        time_multiplier: Number(multiplier) || 1,
        extra_minutes: Number(minutes) || 0,
        reason: reason.trim(),
      }),
    onSuccess: onSaved,
    onError: (error) => setBanner(errorText(error)),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!reason.trim()) return setBanner(t('fieldErrors.required'))
        setBanner(null)
        save.mutate()
      }}
    >
      {banner && <Banner kind="error">{banner}</Banner>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={camera} onChange={(e) => setCamera(e.target.checked)} />
        {t('roles.actions.cameraExempt')}
      </label>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="acc-multiplier" className="block text-sm font-medium">
            {t('roles.actions.timeMultiplier')}
          </label>
          <input
            id="acc-multiplier"
            type="number"
            min={0.5}
            max={4}
            step={0.25}
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="acc-minutes" className="block text-sm font-medium">
            {t('roles.actions.extraMinutes')}
          </label>
          <input
            id="acc-minutes"
            type="number"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
          />
        </div>
      </div>
      <TextAreaField label={t('roles.actions.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
