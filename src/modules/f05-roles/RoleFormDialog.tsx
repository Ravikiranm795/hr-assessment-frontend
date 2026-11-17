import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { applyFieldErrors } from '@/core/forms'
import { roleKeys } from './api'
import type { RoleDetail, RoleRow } from './types'
import { Banner, Dialog, TextAreaField } from './ui'

const schema = z.object({
  title: z.string().trim().min(1, 'required'),
  department: z.string().trim(),
  experience_level: z.string().trim(),
  vacancies: z.number().int().min(1, 'too_small'),
  description: z.string(),
})
type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing; absent when creating. */
  role?: RoleDetail
  onSaved: (role: RoleRow) => void
}

const emptyToNull = (value: string) => (value.trim() === '' ? null : value.trim())

export function RoleFormDialog({ open, onOpenChange, role, onSaved }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      title: role?.title ?? '',
      department: role?.department ?? '',
      experience_level: role?.experience_level ?? '',
      vacancies: role?.vacancies ?? 1,
      description: role?.description ?? '',
    },
  })

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        title: v.title,
        department: emptyToNull(v.department),
        experience_level: emptyToNull(v.experience_level),
        vacancies: v.vacancies,
        description: emptyToNull(v.description),
      }
      return role ? api.patch<RoleRow>(`/api/v1/roles/${role.id}`, body) : api.post<RoleRow>('/api/v1/roles', body)
    },
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: roleKeys.all })
      reset()
      onSaved(saved)
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setBanner(errorText(error))
    },
  })

  const fieldError = (message?: string) =>
    message ? (message === 'required' ? t('fieldErrors.required') : message === 'too_small' ? t('fieldErrors.too_small') : message) : undefined

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setBanner(null)
        onOpenChange(next)
      }}
      title={role ? t('roles.form.editTitle') : t('roles.form.createTitle')}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((v) => {
          setBanner(null)
          save.mutate(v)
        })}
      >
        {banner && <Banner kind="error">{banner}</Banner>}
        <Field label={t('roles.form.title')} error={fieldError(errors.title?.message)} {...register('title')} />
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('roles.form.department')} error={fieldError(errors.department?.message)} {...register('department')} />
          <Field
            label={t('roles.form.experienceLevel')}
            error={fieldError(errors.experience_level?.message)}
            {...register('experience_level')}
          />
        </div>
        <Field
          label={t('roles.form.vacancies')}
          type="number"
          min={1}
          error={fieldError(errors.vacancies?.message)}
          {...register('vacancies', { valueAsNumber: true })}
        />
        <TextAreaField label={t('roles.form.description')} error={fieldError(errors.description?.message)} {...register('description')} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {role ? t('common.save') : t('roles.form.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
