import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { useAuth } from '@/core/auth/AuthProvider'
import { applyFieldErrors } from '@/core/forms'
import { errorText } from '@/core/api/errors'
import { useState } from 'react'
import { Card, SettingsFrame, useSaveSetting, useSetting } from './common'

interface OrgProfile {
  name: string
  slug: string
  locale: string
  timezone: string
}

/** Everyone sees their own account; org admins can also edit the organization profile. */
export function ProfilePage() {
  const { t } = useTranslation()
  const { me, role } = useAuth()
  const isAdmin = role === 'org_admin'
  return (
    <SettingsFrame title={t('settings.profile.title')} subtitle={t('settings.profile.subtitle')}>
      <Card title={t('settings.profile.me')}>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">{t('settings.profile.name')}</dt>
          <dd>{me?.user.name}</dd>
          <dt className="text-muted">{t('settings.profile.email')}</dt>
          <dd>{me?.user.email}</dd>
          <dt className="text-muted">{t('settings.profile.role')}</dt>
          <dd>{role && t(`settings.profile.role_${role}`)}</dd>
        </dl>
      </Card>
      {isAdmin && <OrgProfileCard />}
    </SettingsFrame>
  )
}

function OrgProfileCard() {
  const { t } = useTranslation()
  const { reloadMe } = useAuth()
  const query = useSetting<OrgProfile>('/api/v1/org/profile')
  const save = useSaveSetting<Partial<OrgProfile>>('/api/v1/org/profile', 'patch', () => void reloadMe())
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<OrgProfile>({ values: query.data })

  if (!query.data) return null
  return (
    <Card title={t('settings.profile.org')}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) => {
          setBanner(null)
          save.mutate({ name: v.name, locale: v.locale, timezone: v.timezone }, {
            onError: (e) => {
              if (!applyFieldErrors(e, setError)) setBanner(errorText(e))
            },
          })
        })}
      >
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
        <Field label={t('settings.profile.orgName')} error={errors.name?.message} {...register('name')} />
        <Field label={t('settings.profile.orgLocale')} error={errors.locale?.message} {...register('locale')} />
        <Field label={t('settings.profile.orgTimezone')} hint={t('settings.profile.orgHint')} error={errors.timezone?.message} {...register('timezone')} />
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          {t('settings.save')}
        </Button>
      </form>
    </Card>
  )
}
