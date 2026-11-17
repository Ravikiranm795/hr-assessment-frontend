import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { applyFieldErrors } from '@/core/forms'
import { roleKeys } from './api'
import type { InviteCreated } from './types'
import { Banner, Dialog } from './ui'

const schema = z.object({
  candidate_name: z.string().trim().min(1, 'required'),
  email: z.string().trim().min(1, 'required').pipe(z.email('invalid_format')),
  phone: z.string().trim(),
  expires_in_hours: z.string(),
  send_email: z.boolean(),
})
type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleId: string
  /** Show "send by email" only when the org's email sending is on (flag `email_sending`). */
  canEmail: boolean
  onCreated: (result: InviteCreated) => void
}

const LOCAL_CODES = ['required', 'invalid_format']

/** Client-side zod messages are field-error codes; server-placed messages are already translated. */
const fieldError = (t: (key: string) => string, message?: string) =>
  message === undefined ? undefined : LOCAL_CODES.includes(message) ? t(`fieldErrors.${message}`) : message

export function InviteDialog({ open, onOpenChange, roleId, canEmail, onCreated }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [banner, setBanner] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { candidate_name: '', email: '', phone: '', expires_in_hours: '', send_email: false },
  })

  const create = useMutation({
    mutationFn: ({ values, allowDuplicate }: { values: Values; allowDuplicate: boolean }) =>
      api.post<InviteCreated>(`/api/v1/roles/${roleId}/invites`, {
        candidate_name: values.candidate_name,
        email: values.email,
        phone: values.phone || null,
        expires_in_hours: values.expires_in_hours ? Number(values.expires_in_hours) : null,
        send_email: canEmail && values.send_email,
        allow_duplicate: allowDuplicate,
      }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: roleKeys.all })
      reset()
      setDuplicate(false)
      setBanner(null)
      onCreated(result)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.is('DUPLICATE_INVITE')) {
        setDuplicate(true)
        return
      }
      setDuplicate(false)
      if (!applyFieldErrors(error, setError)) setBanner(errorText(error))
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setBanner(null)
          setDuplicate(false)
        }
        onOpenChange(next)
      }}
      title={t('roles.invite.title')}
      description={t('roles.invite.body')}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setBanner(null)
          setDuplicate(false)
          create.mutate({ values, allowDuplicate: false })
        })}
      >
        {banner && <Banner kind="error">{banner}</Banner>}
        {duplicate && (
          <Banner kind="warning">
            <p className="font-medium">{t('roles.invite.duplicate.title')}</p>
            <p className="mt-1">{t('roles.invite.duplicate.body')}</p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              loading={create.isPending}
              onClick={() => create.mutate({ values: getValues(), allowDuplicate: true })}
            >
              {t('roles.invite.duplicate.anyway')}
            </Button>
          </Banner>
        )}
        <Field
          label={t('roles.invite.name')}
          autoComplete="off"
          error={fieldError(t, errors.candidate_name?.message)}
          {...register('candidate_name')}
        />
        <Field
          label={t('roles.invite.email')}
          type="email"
          autoComplete="off"
          error={fieldError(t, errors.email?.message)}
          {...register('email')}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('roles.invite.phone')} autoComplete="off" {...register('phone')} />
          <Field
            label={t('roles.invite.expiresIn')}
            type="number"
            min={1}
            hint={t('roles.invite.expiresHint')}
            {...register('expires_in_hours')}
          />
        </div>
        {canEmail && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register('send_email')} />
            {t('roles.invite.sendEmail')}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending && !duplicate}>
            {t('roles.invite.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
