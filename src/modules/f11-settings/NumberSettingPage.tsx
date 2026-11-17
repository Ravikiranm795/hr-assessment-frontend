import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { ApiError, errorText, fieldErrorText } from '@/core/api/errors'
import { Card, SettingsFrame, useSaveSetting, useSetting } from './common'

interface Props {
  path: string
  /** Body and response key, for example `retention_days`. */
  field: string
  title: string
  subtitle: string
  label: string
  hint: string
  min: number
  max?: number
}

/** One numeric setting (retention days, invite expiry hours): GET, edit, PATCH. */
function NumberSettingPage({ path, field, title, subtitle, label, hint, min, max }: Props) {
  const { t } = useTranslation()
  const query = useSetting<Record<string, number>>(path)
  const save = useSaveSetting<Record<string, number>>(path)
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<{ value: number }>({ values: query.data ? { value: query.data[field] } : undefined })

  return (
    <SettingsFrame title={title} subtitle={subtitle} query={query}>
      <Card>
        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((v) => {
            setBanner(null)
            save.mutate({ [field]: v.value }, {
              onError: (e) => {
                const first = e instanceof ApiError ? e.fieldErrors[0] : undefined
                if (first) setError('value', { type: 'server', message: fieldErrorText(first.code) })
                else setBanner(errorText(e))
              },
            })
          })}
        >
          {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
          <Field label={label} hint={hint} type="number" min={min} max={max} error={errors.value?.message} {...register('value', { valueAsNumber: true })} />
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            {t('settings.save')}
          </Button>
        </form>
      </Card>
    </SettingsFrame>
  )
}

export function RetentionPage() {
  const { t } = useTranslation()
  return (
    <NumberSettingPage
      path="/api/v1/org/settings/retention"
      field="retention_days"
      title={t('settings.retention.title')}
      subtitle={t('settings.retention.subtitle')}
      label={t('settings.retention.days')}
      hint={t('settings.retention.hint')}
      min={7}
      max={730}
    />
  )
}

export function InvitesPage() {
  const { t } = useTranslation()
  return (
    <NumberSettingPage
      path="/api/v1/org/settings/invites"
      field="invite_default_expiry_hours"
      title={t('settings.invites.title')}
      subtitle={t('settings.invites.subtitle')}
      label={t('settings.invites.hours')}
      hint={t('settings.invites.hint')}
      min={1}
    />
  )
}
