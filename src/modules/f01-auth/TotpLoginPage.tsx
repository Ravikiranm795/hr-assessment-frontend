import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import type { SessionOut } from '@/core/auth/types'
import { AuthLayout } from './AuthLayout'
import { nextAfterLogin } from './nextAfterLogin'

interface LocationState {
  totpToken?: string
  from?: string
}

/** Second step for admins with an authenticator app. Accepts a 6-digit code or a recovery code. */
export function TotpLoginPage() {
  const { t } = useTranslation()
  const { completeLogin } = useAuth()
  const navigate = useNavigate()
  const state = (useLocation().state ?? {}) as LocationState
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ code: string }>()

  // The challenge token is held in router state only; a refresh loses it and sends the user back.
  if (!state.totpToken) return <Navigate to="/login" replace />

  async function onSubmit({ code }: { code: string }) {
    setBanner(null)
    try {
      const session = await api.post<SessionOut>(
        '/api/v1/auth/login/totp',
        { totp_token: state.totpToken, code: code.trim() },
        { skipRefresh: true },
      )
      await completeLogin(session)
      const back = state.from?.startsWith('/') ? state.from : '/'
      navigate(nextAfterLogin(session) ?? back, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setBanner(t('totpLogin.expired'))
      else setBanner(errorText(error))
    }
  }

  return (
    <AuthLayout title={t('totpLogin.title')} body={t('totpLogin.body')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {banner && (
          <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
            {banner}
          </p>
        )}
        <Field
          label={t('totpLogin.code.label')}
          placeholder={t('totpLogin.code.placeholder')}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          {...register('code', { required: true })}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t('totpLogin.submit')}
        </Button>
        <Link to="/login" className="block text-center text-sm text-primary underline">
          {t('totpLogin.backToLogin')}
        </Link>
      </form>
    </AuthLayout>
  )
}
