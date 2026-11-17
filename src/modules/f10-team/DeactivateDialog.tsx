import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import type { TeamPage, TeamUser } from './types'

interface Props {
  user: TeamUser | null
  onClose: () => void
  onDone: () => void
}

/** Deactivate (never deletes), optionally moving the person's open roles to another active HR user. */
export function DeactivateDialog({ user, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [reassign, setReassign] = useState('')
  const [reason, setReason] = useState('')

  const candidates = useQuery({
    queryKey: ['team', 'reassign-candidates'],
    queryFn: () => api.get<TeamPage>('/api/v1/team/users', { status: 'active', page_size: 100, sort: 'name:asc' }),
    enabled: user !== null,
  })
  const options = (candidates.data?.items ?? []).filter((u) => u.id !== user?.id)

  const deactivate = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/team/users/${user!.id}/deactivate`, { reassign_roles_to: reassign || null, reason: reason.trim() || null }),
    onSuccess: () => {
      toast.success(t('team.toast.deactivated'))
      setReassign('')
      setReason('')
      onClose()
      onDone()
    },
    onError: (error) => {
      onClose()
      toast.error(error)
    },
  })

  return (
    <Modal open={user !== null} onOpenChange={(open) => !open && onClose()} title={t('team.deactivate_dialog.title', { name: user?.name })} description={t('team.deactivate_dialog.body')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          deactivate.mutate()
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="reassign" className="block text-sm font-medium">
            {t('team.deactivate_dialog.reassign')}
          </label>
          <select id="reassign" className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm" value={reassign} onChange={(e) => setReassign(e.target.value)}>
            <option value="">{t('team.deactivate_dialog.reassignNone')}</option>
            {options.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <Textarea label={t('team.deactivate_dialog.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" loading={deactivate.isPending}>
            {t('team.deactivate_dialog.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
