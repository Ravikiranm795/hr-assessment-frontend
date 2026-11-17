import { useMutation } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Field } from '@/components/Field'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import type { components } from '@/api-types/schema'
import { AuthLayout } from './AuthLayout'

type SetupOut = components['schemas']['TotpSetupOut']
type VerifyOut = components['schemas']['TotpVerifyOut']

/** QR + manual key, verify, then recovery codes shown exactly once (spec F1). */
export function TotpSetupPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { reloadMe } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string[] | null>(null)

  const setup = useMutation({ mutationFn: () => api.post<SetupOut>('/api/v1/auth/totp/setup') })
  const verify = useMutation({
    mutationFn: () => api.post<VerifyOut>('/api/v1/auth/totp/verify', { code: code.trim() }),
    onSuccess: (data) => setRecovery(data.recovery_codes),
    onError: (error) => setBanner(errorText(error)),
  })

  // Start the setup once on mount. Mutate, not query: each call issues a new secret.
  useEffect(() => {
    setup.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function done() {
    await reloadMe()
    navigate('/', { replace: true })
  }

  if (recovery) {
    return (
      <AuthLayout title={t('totpSetup.recovery.title')} body={t('totpSetup.recovery.body')}>
        <ul className="grid grid-cols-2 gap-2 rounded-(--radius) bg-bg p-4 font-mono text-sm">
          {recovery.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(recovery.join('\n')).then(() => toast.success(t('totpSetup.recovery.copied')))
            }}
          >
            {t('totpSetup.recovery.copy')}
          </Button>
          <Button onClick={() => void done()}>{t('totpSetup.recovery.saved')}</Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('totpSetup.title')} body={t('totpSetup.body')}>
      {setup.isPending && <Spinner label={t('common.loading')} />}
      {setup.isError && <ErrorState error={setup.error} onRetry={() => setup.mutate()} />}
      {setup.data && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setBanner(null)
            verify.mutate()
          }}
        >
          <div className="flex justify-center rounded-(--radius) bg-white p-3">
            <QRCodeSVG value={setup.data.otpauth_uri} size={176} role="img" aria-label={t('totpSetup.qrAlt')} />
          </div>
          <p className="text-center text-xs text-muted">
            {t('totpSetup.manualKey')}: <span className="font-mono break-all text-text">{setup.data.secret}</span>
          </p>
          {banner && (
            <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
              {banner}
            </p>
          )}
          <Field
            label={t('totpSetup.code.label')}
            placeholder={t('totpSetup.code.placeholder')}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={verify.isPending} disabled={code.trim().length < 6}>
            {t('totpSetup.verify')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
