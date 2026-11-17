import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Textarea } from '@/components/Textarea'
import { errorText } from '@/core/api/errors'
import { applyFieldErrors } from '@/core/forms'
import { Card, Check, SettingsFrame, useSaveSetting, useSetting } from './common'

interface Security {
  allowed_google_domains: string[]
  session_timeout_minutes: number
  password_policy: { min_length: number; history: number; blocklist: boolean }
  totp_required_for_admins: boolean
}
interface Values {
  domains: string
  session_timeout_minutes: number
  min_length: number
  history: number
  blocklist: boolean
  totp_required_for_admins: boolean
}

const PATH = '/api/v1/org/settings/security'
const toValues = (s: Security): Values => ({
  domains: s.allowed_google_domains.join('\n'),
  session_timeout_minutes: s.session_timeout_minutes,
  min_length: s.password_policy.min_length,
  history: s.password_policy.history,
  blocklist: s.password_policy.blocklist,
  totp_required_for_admins: s.totp_required_for_admins,
})

export function SecurityPage() {
  const { t } = useTranslation()
  const query = useSetting<Security>(PATH)
  const save = useSaveSetting<unknown>(PATH)
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Values>({ values: query.data && toValues(query.data) })

  return (
    <SettingsFrame title={t('settings.security.title')} subtitle={t('settings.security.subtitle')} query={query}>
      <form
        className="space-y-6"
        noValidate
        onSubmit={handleSubmit((v) => {
          setBanner(null)
          save.mutate(
            {
              allowed_google_domains: v.domains.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean),
              session_timeout_minutes: v.session_timeout_minutes,
              password_policy: { min_length: v.min_length, history: v.history, blocklist: v.blocklist },
              totp_required_for_admins: v.totp_required_for_admins,
            },
            { onError: (e) => { if (!applyFieldErrors(e, setError)) setBanner(errorText(e)) } },
          )
        })}
      >
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
        <Card>
          <Textarea label={t('settings.security.domains')} rows={3} error={errors.domains?.message} {...register('domains')} />
          <p className="-mt-2 text-xs text-muted">{t('settings.security.domainsHint')}</p>
          <Field label={t('settings.security.timeout')} type="number" min={5} error={errors.session_timeout_minutes?.message} {...register('session_timeout_minutes', { valueAsNumber: true })} />
        </Card>
        <Card title={t('settings.security.passwords')}>
          <Field label={t('settings.security.minLength')} type="number" min={8} error={errors.min_length?.message} {...register('min_length', { valueAsNumber: true })} />
          <Field label={t('settings.security.history')} hint={t('settings.security.historyHint')} type="number" min={0} error={errors.history?.message} {...register('history', { valueAsNumber: true })} />
          <Check id="blocklist" label={t('settings.security.blocklist')} checked={!!watch('blocklist')} onChange={(v) => setValue('blocklist', v, { shouldDirty: true })} />
        </Card>
        <Card>
          <Check id="totp" label={t('settings.security.totp')} hint={t('settings.security.totpHint')} checked={!!watch('totp_required_for_admins')} onChange={(v) => setValue('totp_required_for_admins', v, { shouldDirty: true })} />
        </Card>
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          {t('settings.save')}
        </Button>
      </form>
    </SettingsFrame>
  )
}
