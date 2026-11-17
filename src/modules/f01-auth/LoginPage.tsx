import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { api } from '@/core/api/client'
import { ApiError, NetworkError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import type { SessionOut } from '@/core/auth/types'
import { applyFieldErrors } from '@/core/forms'
import { AuthLayout } from './AuthLayout'
import { GoogleButton } from './GoogleButton'
import { nextAfterLogin } from './nextAfterLogin'

const schema = z.object({
  email: z.string().min(1, 'required'),
  password: z.string().min(1, 'required'),
})
type Values = z.infer<typeof schema>

/** Where the user was heading before being sent to login. */
function useReturnPath() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return from && from.startsWith('/') ? from : '/'
}

export function LoginPage() {
  const { t } = useTranslation()
  const { status, completeLogin } = useAuth()
  const navigate = useNavigate()
  const returnPath = useReturnPath()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  if (status === 'authenticated') return <Navigate to={returnPath} replace />

  /** One path for password and Google sign-in: second factor, then setup, then the app. */
  async function finish(session: SessionOut) {
    if (session.totp_required && session.totp_token) {
      navigate('/login/totp', { replace: true, state: { totpToken: session.totp_token, from: returnPath } })
      return
    }
    await completeLogin(session)
    navigate(nextAfterLogin(session) ?? returnPath, { replace: true })
  }

  async function onSubmit(values: Values) {
    setBanner(null)
    try {
      const session = await api.post<SessionOut>('/api/v1/auth/login', values, { skipRefresh: true })
      await finish(session)
    } catch (error) {
      if (applyFieldErrors(error, setError)) return
      if (error instanceof ApiError && error.is('ACCOUNT_LOCKED')) setBanner(t('login.error.locked'))
      else if (error instanceof ApiError && error.is('INVALID_CREDENTIALS')) setBanner(t('login.error.generic'))
      else if (error instanceof ApiError || error instanceof NetworkError) setBanner(errorText(error))
      else setBanner(t('errors.unknown'))
    }
  }

  async function onGoogle(idToken: string) {
    setBanner(null)
    try {
      await finish(await api.post<SessionOut>('/api/v1/auth/google', { id_token: idToken }, { skipRefresh: true }))
    } catch (error) {
      setBanner(error instanceof ApiError && error.is('RATE_LIMITED') ? errorText(error) : t('login.error.google'))
    }
  }

  return (
    <AuthLayout title={t('login.title')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {banner && (
          <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
            {banner}
          </p>
        )}
        <Field
          label={t('login.form.email.label')}
          type="email"
          autoComplete="username"
          placeholder={t('login.form.email.placeholder')}
          error={errors.email && t('fieldErrors.required')}
          {...register('email')}
        />
        <Field
          label={t('login.form.password.label')}
          type="password"
          autoComplete="current-password"
          placeholder={t('login.form.password.placeholder')}
          error={errors.password && t('fieldErrors.required')}
          {...register('password')}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t('login.form.submit')}
        </Button>
      </form>
      <GoogleButton onToken={onGoogle} />
    </AuthLayout>
  )
}
