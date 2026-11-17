import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { applyFieldErrors } from '@/core/forms'
import { AuthLayout } from './AuthLayout'

const schema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(1),
    confirm: z.string().min(1),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'mismatch' })
type Values = z.infer<typeof schema>

/**
 * Forced on first login (`must_change_password`). The organization's password policy is only readable
 * by admins and not at all while the change is pending, so the server's PASSWORD_POLICY_FAILED answer
 * is the source of truth (see API_GAPS).
 */
export function ChangePasswordPage() {
  const { t } = useTranslation()
  const { me, reloadMe } = useAuth()
  const navigate = useNavigate()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  async function onSubmit({ current_password, new_password }: Values) {
    setBanner(null)
    try {
      await api.post('/api/v1/auth/change-password', { current_password, new_password })
      await reloadMe()
      navigate(me?.totp_setup_required ? '/totp/setup' : '/', { replace: true })
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setBanner(errorText(error))
    }
  }

  return (
    <AuthLayout title={t('changePassword.title')} body={t('changePassword.body')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {banner && (
          <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
            {banner}
          </p>
        )}
        <Field
          label={t('changePassword.current.label')}
          type="password"
          autoComplete="current-password"
          error={errors.current_password && (errors.current_password.message || t('fieldErrors.required'))}
          {...register('current_password')}
        />
        <Field
          label={t('changePassword.new.label')}
          type="password"
          autoComplete="new-password"
          hint={t('changePassword.hint')}
          error={errors.new_password && (errors.new_password.message || t('fieldErrors.required'))}
          {...register('new_password')}
        />
        <Field
          label={t('changePassword.confirm.label')}
          type="password"
          autoComplete="new-password"
          error={errors.confirm && (errors.confirm.message === 'mismatch' ? t('changePassword.confirm.mismatch') : t('fieldErrors.required'))}
          {...register('confirm')}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t('changePassword.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
