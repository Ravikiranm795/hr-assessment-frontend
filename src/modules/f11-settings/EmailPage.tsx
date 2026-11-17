import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { applyFieldErrors } from '@/core/forms'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { Card, Check, Select, SettingsFrame, useSaveSetting, useSetting } from './common'

interface EmailSettings {
  configured: boolean
  host: string | null
  port: number | null
  security: 'none' | 'starttls' | 'tls' | null
  username: string | null
  password_set: boolean
  password_masked: string | null
  sender_name: string | null
  sender_email: string | null
  enabled: boolean
  verified_at: string | null
}
interface Values {
  host: string
  port: number
  security: 'none' | 'starttls' | 'tls'
  username: string
  password: string
  sender_name: string
  sender_email: string
  enabled: boolean
}

const PATH = '/api/v1/org/settings/email'

export function EmailPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const query = useSetting<EmailSettings>(PATH)
  const save = useSaveSetting<unknown>(PATH, 'put')
  const [banner, setBanner] = useState<string | null>(null)
  const [testTo, setTestTo] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const s = query.data

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    // The password is write-only: never pre-filled (spec 8.9).
    values: s && {
      host: s.host ?? '',
      port: s.port ?? 587,
      security: s.security ?? 'starttls',
      username: s.username ?? '',
      password: '',
      sender_name: s.sender_name ?? '',
      sender_email: s.sender_email ?? '',
      enabled: s.enabled,
    },
  })

  const test = useMutation({
    mutationFn: () => api.post<{ sent: boolean; reason?: string | null }>(`${PATH}/test`, { to: testTo.trim() }),
    onSuccess: (r) => setTestResult(r.sent ? { ok: true, text: t('settings.email.testOk') } : { ok: false, text: t('settings.email.testFail', { reason: r.reason ?? '' }) }),
    onError: (e) => setTestResult({ ok: false, text: errorText(e) }),
  })

  return (
    <SettingsFrame title={t('settings.email.title')} subtitle={t('settings.email.subtitle')} query={query}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={s?.enabled ? 'success' : 'neutral'}>{s?.enabled ? t('settings.email.status.on') : t('settings.email.status.off')}</Badge>
        <span className="text-xs text-muted">{s?.verified_at ? t('settings.email.status.verified', { when: formatDateTime(s.verified_at, me?.organization?.timezone) }) : t('settings.email.status.notVerified')}</span>
      </div>

      <form
        className="space-y-6"
        noValidate
        onSubmit={handleSubmit((v) => {
          setBanner(null)
          save.mutate(
            {
              host: v.host.trim(),
              port: v.port,
              security: v.security,
              username: v.username.trim() || null,
              // Only send a password when one was typed; blank keeps the saved one.
              ...(v.password ? { password: v.password } : {}),
              sender_name: v.sender_name.trim() || null,
              sender_email: v.sender_email.trim(),
              enabled: v.enabled,
            },
            { onError: (e) => { if (!applyFieldErrors(e, setError)) setBanner(errorText(e)) } },
          )
        })}
      >
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
        <Card>
          <Field label={t('settings.email.host')} error={errors.host?.message} {...register('host')} />
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('settings.email.port')} type="number" error={errors.port?.message} {...register('port', { valueAsNumber: true })} />
            <Select id="smtp-security" label={t('settings.email.security')} value={watch('security') ?? 'starttls'} onChange={(v) => setValue('security', v as Values['security'], { shouldDirty: true })}>
              <option value="none">{t('settings.email.security_none')}</option>
              <option value="starttls">{t('settings.email.security_starttls')}</option>
              <option value="tls">{t('settings.email.security_tls')}</option>
            </Select>
          </div>
          <Field label={t('settings.email.username')} autoComplete="off" error={errors.username?.message} {...register('username')} />
          <Field
            label={t('settings.email.password')}
            type="password"
            autoComplete="new-password"
            placeholder={s?.password_set ? (s.password_masked ?? '••••••••') : undefined}
            hint={s?.password_set ? t('settings.writeOnly.set') : t('settings.writeOnly.unset')}
            error={errors.password?.message}
            {...register('password')}
          />
          <Field label={t('settings.email.senderName')} error={errors.sender_name?.message} {...register('sender_name')} />
          <Field label={t('settings.email.senderEmail')} type="email" error={errors.sender_email?.message} {...register('sender_email')} />
          <Check id="smtp-enabled" label={t('settings.email.enabled')} checked={!!watch('enabled')} onChange={(v) => setValue('enabled', v, { shouldDirty: true })} />
        </Card>
        <Button type="submit" loading={save.isPending}>
          {t('settings.save')}
        </Button>
      </form>

      <Card title={t('settings.email.testTitle')}>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field label={t('settings.email.testTo')} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </div>
          <Button variant="outline" loading={test.isPending} disabled={!testTo.trim() || !s?.configured} onClick={() => { setTestResult(null); test.mutate() }}>
            {t('settings.email.testSend')}
          </Button>
        </div>
        {testResult && (
          <p role="status" className={testResult.ok ? 'text-sm text-success' : 'text-sm text-error'}>
            {testResult.text}
          </p>
        )}
      </Card>
    </SettingsFrame>
  )
}
