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
import { ApiError, errorText, fieldErrorText } from '@/core/api/errors'
import type { Org, OrgUser } from './types'

const schema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim(),
  adminName: z.string().trim().min(1),
  adminEmail: z.string().trim().min(1),
  isDemo: z.boolean(),
})
type Values = z.infer<typeof schema>

interface Created {
  organization: Org
  admin: OrgUser
  temporary_password: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (created: Created) => void
}

const FIELD_MAP: Record<string, keyof Values> = { name: 'name', slug: 'slug', 'admin.name': 'adminName', 'admin.email': 'adminEmail' }

/** Creates the organization together with its first administrator (spec F12). */
export function CreateOrgDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', slug: '', adminName: '', adminEmail: '', isDemo: false } })

  const create = useMutation({
    mutationFn: (v: Values) =>
      api.post<Created>('/api/v1/platform/orgs', {
        name: v.name,
        slug: v.slug || null,
        is_demo: v.isDemo,
        admin: { name: v.adminName, email: v.adminEmail },
      }),
    onSuccess: (data) => {
      reset()
      onOpenChange(false)
      onCreated(data)
    },
    onError: (error) => {
      let placed = 0
      if (error instanceof ApiError) {
        for (const { field, code } of error.fieldErrors) {
          const name = FIELD_MAP[field.replace(/^body\./, '')]
          if (name) {
            setError(name, { type: 'server', message: fieldErrorText(code) })
            placed += 1
          }
        }
      }
      if (!placed) setBanner(errorText(error))
    },
  })

  const required = (key: 'name' | 'adminName' | 'adminEmail') => errors[key] && (errors[key].type === 'server' ? errors[key].message : t('fieldErrors.required'))

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
      title={t('platform.orgs.create.title')}
      description={t('platform.orgs.create.body')}
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
        <Field label={t('platform.orgs.create.name')} autoComplete="off" error={required('name')} {...register('name')} />
        <Field
          label={t('platform.orgs.create.slug')}
          hint={t('platform.orgs.create.slugHint')}
          autoComplete="off"
          error={errors.slug?.type === 'server' ? errors.slug.message : undefined}
          {...register('slug')}
        />
        <Field label={t('platform.orgs.create.adminName')} autoComplete="off" error={required('adminName')} {...register('adminName')} />
        <Field label={t('platform.orgs.create.adminEmail')} type="email" autoComplete="off" error={required('adminEmail')} {...register('adminEmail')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-(--color-primary)" {...register('isDemo')} />
          {t('platform.orgs.create.demo')}
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {t('platform.orgs.create.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
