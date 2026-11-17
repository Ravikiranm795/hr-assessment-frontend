import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { useMutation } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import type { TeamUser } from './types'

type Confirm = 'reset' | 'signOut' | 'reactivate'
interface Props {
  user: TeamUser
  onChanged: () => void
  onDeactivate: (user: TeamUser) => void
  onTempPassword: (name: string, password: string) => void
}

const item = 'cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-bg'

/** Actions for an HR user. Administrator rows are read-only (spec F10) and never reach this component. */
export function RowActions({ user, onChanged, onDeactivate, onTempPassword }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const base = `/api/v1/team/users/${user.id}`
  const done = (message: string) => {
    toast.success(message)
    setConfirm(null)
    onChanged()
  }
  const fail = (error: unknown) => {
    setConfirm(null)
    toast.error(error)
  }

  const reset = useMutation({
    mutationFn: () => api.post<{ temporary_password: string }>(`${base}/reset-password`),
    onSuccess: (d) => {
      setConfirm(null)
      onChanged()
      onTempPassword(user.name, d.temporary_password)
    },
    onError: fail,
  })
  const signOut = useMutation({ mutationFn: () => api.post(`${base}/sign-out-everywhere`), onSuccess: () => done(t('team.toast.signedOut')), onError: fail })
  const reactivate = useMutation({ mutationFn: () => api.post(`${base}/reactivate`), onSuccess: () => done(t('team.toast.reactivated')), onError: fail })
  const unlock = useMutation({ mutationFn: () => api.post(`${base}/unlock`), onSuccess: () => done(t('team.toast.unlocked')), onError: fail })

  const inactive = user.status !== 'active'
  const name = user.name

  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text" aria-label={t('team.actions.menu', { name })}>
          <MoreHorizontal className="size-5" aria-hidden />
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" className="z-40 min-w-52 rounded-(--radius) border border-border bg-surface p-1 shadow-card">
            {!inactive && <Dropdown.Item className={item} onSelect={() => setConfirm('reset')}>{t('team.actions.resetPassword')}</Dropdown.Item>}
            {user.is_locked && <Dropdown.Item className={item} onSelect={() => unlock.mutate()}>{t('team.actions.unlock')}</Dropdown.Item>}
            {!inactive && <Dropdown.Item className={item} onSelect={() => setConfirm('signOut')}>{t('team.actions.signOutEverywhere')}</Dropdown.Item>}
            {inactive ? (
              <Dropdown.Item className={item} onSelect={() => setConfirm('reactivate')}>{t('team.actions.reactivate')}</Dropdown.Item>
            ) : (
              <Dropdown.Item className={item} onSelect={() => onDeactivate(user)}>{t('team.actions.deactivate')}</Dropdown.Item>
            )}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>

      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('team.confirm.resetTitle', { name })}
        body={t('team.confirm.resetBody')}
        confirmLabel={t('team.actions.resetPassword')}
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
      <ConfirmDialog
        open={confirm === 'signOut'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('team.confirm.signOutTitle', { name })}
        body={t('team.confirm.signOutBody')}
        confirmLabel={t('team.actions.signOutEverywhere')}
        loading={signOut.isPending}
        onConfirm={() => signOut.mutate()}
      />
      <ConfirmDialog
        open={confirm === 'reactivate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('team.confirm.reactivateTitle', { name })}
        body={t('team.confirm.reactivateBody')}
        confirmLabel={t('team.actions.reactivate')}
        loading={reactivate.isPending}
        onConfirm={() => reactivate.mutate()}
      />
    </>
  )
}
