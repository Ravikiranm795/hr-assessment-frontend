import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
  const [params] = useSearchParams()
  const ssoError = params.get('sso_error')
  const [banner, setBanner] = useState<string | null>(
    ssoError ? t(`ssoLogin.error.${ssoError === 'expired' || ssoError === 'unavailable' ? ssoError : 'failed'}`) : null,
  )
  const [sso, setSso] = useState<{ email: string; provider: string | null; required: boolean } | null>(null)
  const [ssoBusy, setSsoBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })
  const emailField = register('email')

  if (status === 'authenticated') return <Navigate to={returnPath} replace />

  /** Ask which sign-in the email's domain uses. The answer only says whether SSO exists for the domain. */
  async function discover(raw: string) {
    const email = raw.trim()
    if (!email.includes('@') || sso?.email === email) return
    try {
      const r = await api.post<{ sso: boolean; provider: string | null; sso_required: boolean }>('/api/v1/auth/sso/discover', { email }, { skipRefresh: true })
      if (getValues('email').trim() !== email) return
      setSso(r.sso ? { email, provider: r.provider, required: r.sso_required } : null)
      setShowPassword(false)
    } catch {
      // Discovery is optional: on any failure the normal password form stays in place.
      setSso(null)
    }
  }

  async function startSso() {
    const email = getValues('email').trim()
    setBanner(null)
    setSsoBusy(true)
    try {
      const r = await api.post<{ authorize_url: string }>('/api/v1/auth/sso/start', { email }, { skipRefresh: true })
      window.location.assign(r.authorize_url)
    } catch (error) {
      setSsoBusy(false)
      setBanner(error instanceof ApiError && error.is('RATE_LIMITED') ? errorText(error) : t('ssoLogin.error.unavailable'))
    }
  }

  const providerName = sso ? t(`ssoLogin.provider.${sso.provider === 'google' || sso.provider === 'microsoft' ? sso.provider : 'oidc'}`) : ''
  const passwordVisible = !sso || !sso.required || showPassword

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
          {...emailField}
          onChange={(e) => {
            void emailField.onChange(e)
            if (sso && sso.email !== e.target.value.trim()) setSso(null)
          }}
          onBlur={(e) => {
            void emailField.onBlur(e)
            void discover(e.target.value)
          }}
        />
        {sso && (
          <div className="space-y-2">
            <Button type="button" className="w-full" loading={ssoBusy} onClick={() => void startSso()}>
              {t('ssoLogin.continue', { provider: providerName })}
            </Button>
            {sso.required ? (
              <p className="text-xs text-muted">{t('ssoLogin.requiredHint')}</p>
            ) : (
              <p className="text-center text-xs text-muted">{t('ssoLogin.orPassword')}</p>
            )}
            {sso.required && !showPassword && (
              <button type="button" className="block w-full text-center text-sm text-primary underline" onClick={() => setShowPassword(true)}>
                {t('ssoLogin.usePassword')}
              </button>
            )}
          </div>
        )}
        {passwordVisible && (
          <>
            <Field
              label={t('login.form.password.label')}
              type="password"
              autoComplete="current-password"
              placeholder={t('login.form.password.placeholder')}
              error={errors.password && t('fieldErrors.required')}
              {...register('password')}
            />
            <Button type="submit" variant={sso ? 'outline' : 'primary'} className="w-full" loading={isSubmitting}>
              {sso ? t('ssoLogin.signInWithPassword') : t('login.form.submit')}
            </Button>
          </>
        )}
      </form>
      <GoogleButton onToken={onGoogle} />
    </AuthLayout>
  )
}
