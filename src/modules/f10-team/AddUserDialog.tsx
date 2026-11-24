import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { applyFieldErrors } from '@/core/forms'
import type { TeamUser } from './types'

const schema = z.object({ name: z.string().trim().min(1), email: z.string().trim().min(1), role: z.enum(['hr_user', 'engineer']) })
type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (user: TeamUser, temporaryPassword: string) => void
}

export function AddUserDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { role: 'hr_user' } })

  const create = useMutation({
    mutationFn: (v: Values) => api.post<{ user: TeamUser; temporary_password: string }>('/api/v1/team/users', v),
    onSuccess: (data) => {
      reset()
      onOpenChange(false)
      onCreated(data.user, data.temporary_password)
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setBanner(errorText(error))
    },
  })

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          setBanner(null)
        }
        onOpenChange(next)
      }}
      title={t('team.add_dialog.title')}
      description={t('team.add_dialog.body')}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) => {
          setBanner(null)
          create.mutate(v)
        })}
      >
        {banner && (
          <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
            {banner}
          </p>
        )}
        <Field label={t('team.add_dialog.name')} autoComplete="off" error={errors.name && (errors.name.type === 'server' ? errors.name.message : t('fieldErrors.required'))} {...register('name')} />
        <Field label={t('team.add_dialog.email')} type="email" autoComplete="off" error={errors.email && (errors.email.type === 'server' ? errors.email.message : t('fieldErrors.required'))} {...register('email')} />
        <div className="space-y-1.5">
          <label htmlFor="add-user-role" className="block text-sm font-medium">
            {t('team.add_dialog.role')}
          </label>
          <select id="add-user-role" className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm" {...register('role')}>
            <option value="hr_user">{t('team.role.hr_user')}</option>
            <option value="engineer">{t('team.role.engineer')}</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {t('team.add_dialog.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
