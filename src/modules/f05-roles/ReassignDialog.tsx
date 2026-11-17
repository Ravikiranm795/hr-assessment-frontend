import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { roleKeys, useTeamUsers } from './api'
import type { RoleDetail } from './types'
import { Banner, Dialog, SelectField } from './ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: RoleDetail
}

/** Org admin only: the team list is not readable by HR users (see API_GAPS). */
export function ReassignDialog({ open, onOpenChange, role }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const toast = useToast()
  const users = useTeamUsers(open)
  const [owner, setOwner] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const candidates = (users.data?.items ?? []).filter((u) => u.role === 'hr_user' || u.role === 'org_admin')
  const selected = owner || role.owner_id

  const reassign = useMutation({
    mutationFn: () => api.post(`/api/v1/roles/${role.id}/reassign`, { owner_id: selected }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: roleKeys.all })
      toast.success(t('roles.reassign.done'))
      onOpenChange(false)
    },
    onError: (error) => setBanner(errorText(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('roles.reassign.title')} description={t('roles.reassign.body')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setBanner(null)
          reassign.mutate()
        }}
      >
        {banner && <Banner kind="error">{banner}</Banner>}
        {users.isError && <Banner kind="error">{errorText(users.error)}</Banner>}
        <SelectField label={t('roles.reassign.owner')} value={selected} onChange={(e) => setOwner(e.target.value)}>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </SelectField>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={reassign.isPending} disabled={selected === role.owner_id}>
            {t('roles.reassign.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
