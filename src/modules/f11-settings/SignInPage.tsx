import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError, errorText, fieldErrorText } from '@/core/api/errors'
import { formatDateTime } from '@/core/utils'
import { useAuth } from '@/core/auth/AuthProvider'
import { Card, SettingsFrame, useSaveSetting, useSetting } from './common'

type Provider = 'google' | 'microsoft' | 'oidc'
type Status = 'not_set_up' | 'needs_test' | 'disabled' | 'active'

interface SsoSettings {
  configured: boolean
  provider: Provider | null
  enabled: boolean
  verified: boolean
  verified_at: string | null
  status: Status
  issuer: string | null
  tenant_id: string | null
  client_id: string | null
  has_secret: boolean
  scopes: string | null
  domains: string[]
  sso_required: boolean
  redirect_uri: string
}

interface Values {
  provider: Provider
  client_id: string
  client_secret: string
  tenant_id: string
  issuer: string
  scopes: string
  domains: string[]
  enabled: boolean
  sso_required: boolean
}

const PATH = '/api/v1/org/settings/sso'
const PROVIDERS: Provider[] = ['google', 'microsoft', 'oidc']
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const STATUS_TONE = { not_set_up: 'neutral', needs_test: 'warning', disabled: 'neutral', active: 'success' } as const

/** Tag-style input for allowed email domains: Enter, comma, space or leaving the field adds the tag. */
function DomainInput({ value, onChange, error }: { value: string[]; onChange: (next: string[]) => void; error?: string }) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  function commit(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const d of parts) {
      if (!DOMAIN_RE.test(d)) {
        setProblem(t('settings.signIn.domains.invalid', { value: d }))
        setText(d)
        onChange(next)
        return
      }
      if (!next.includes(d)) next.push(d)
    }
    setProblem(null)
    setText('')
    onChange(next)
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      commit(text)
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  const shown = problem ?? error
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{t('settings.signIn.domains.label')}</label>
      <div className={`flex flex-wrap items-center gap-2 rounded-(--radius) border bg-surface p-2 ${shown ? 'border-error' : 'border-border'}`}>
        {value.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-0.5 text-sm">
            {d}
            <button type="button" className="rounded-full px-1 text-muted hover:text-error" aria-label={t('settings.signIn.domains.remove', { value: d })} onClick={() => onChange(value.filter((x) => x !== d))}>
              <span aria-hidden>×</span>
            </button>
          </span>
        ))}
        <input
          id={id}
          className="h-8 min-w-48 flex-1 bg-transparent px-1 text-sm outline-none"
          value={text}
          placeholder={t('settings.signIn.domains.placeholder')}
          autoComplete="off"
          aria-invalid={shown ? true : undefined}
          aria-describedby={`${id}-hint`}
          onChange={(e) => { setText(e.target.value); setProblem(null) }}
          onKeyDown={onKey}
          onBlur={() => commit(text)}
        />
      </div>
      {shown ? <p id={`${id}-hint`} role="alert" className="text-xs text-error">{shown}</p> : <p id={`${id}-hint`} className="text-xs text-muted">{t('settings.signIn.domains.hint')}</p>}
    </div>
  )
}

function Switch({ id, label, hint, checked, disabled, disabledReason, onChange }: { id: string; label: string; hint?: string; checked: boolean; disabled?: boolean; disabledReason?: string; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-primary bg-primary' : 'border-border bg-bg'}`}
      >
        <span aria-hidden className={`absolute top-0.5 left-0.5 size-4.5 rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <div className="text-sm">
        <label htmlFor={id} className="font-medium">{label}</label>
        <p id={`${id}-hint`} className="text-xs text-muted">{disabled && disabledReason ? disabledReason : hint}</p>
      </div>
    </div>
  )
}

export function SignInPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const toast = useToast()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const query = useSetting<SsoSettings>(PATH)
  const [banner, setBanner] = useState<string | null>(null)
  const [testBanner, setTestBanner] = useState<{ ok: boolean; text: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [copied, setCopied] = useState(false)
  const s = query.data

  const save = useSaveSetting<unknown>(PATH, 'put')
  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Values>({
    // The secret is write-only: never pre-filled.
    values: s && {
      provider: s.provider ?? 'google',
      client_id: s.client_id ?? '',
      client_secret: '',
      tenant_id: s.tenant_id ?? '',
      issuer: s.issuer && s.provider === 'oidc' ? s.issuer : '',
      scopes: s.scopes ?? '',
      domains: s.domains,
      enabled: s.enabled,
      sso_required: s.sso_required,
    },
  })

  // The identity provider sends the admin back here with ?sso_test=ok|failed.
  useEffect(() => {
    const result = params.get('sso_test')
    if (!result) return
    setTestBanner(result === 'ok' ? { ok: true, text: t('settings.signIn.test.ok') } : { ok: false, text: t('settings.signIn.test.failed') })
    void client.invalidateQueries({ queryKey: ['settings', PATH] })
    setParams((p) => { p.delete('sso_test'); return p }, { replace: true })
  }, [params, setParams, client, t])

  const test = useMutation({
    mutationFn: () => api.post<{ authorize_url: string }>(`${PATH}/test`, {}),
    onSuccess: (r) => window.location.assign(r.authorize_url),
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors.some((f) => f.code === 'admin_domain_not_listed')) setTestBanner({ ok: false, text: t('settings.signIn.test.domainNotListed') })
      else if (e instanceof ApiError && e.is('SSO_NOT_CONFIGURED')) setTestBanner({ ok: false, text: t('settings.signIn.test.notConfigured') })
      else setTestBanner({ ok: false, text: errorText(e) })
    },
  })

  const remove = useMutation({
    mutationFn: () => api.delete(PATH),
    onSuccess: () => {
      setRemoving(false)
      setTestBanner(null)
      toast.success(t('settings.signIn.removed'))
      void client.invalidateQueries({ queryKey: ['settings', PATH] })
    },
    onError: (e) => { setRemoving(false); setBanner(errorText(e)) },
  })

  const provider = watch('provider') ?? 'google'
  const enabled = !!watch('enabled')
  const required = !!watch('sso_required')
  const domains = watch('domains') ?? []
  const verified = !!s?.verified && !isDirty

  function fieldMessage(field: string, code: string, value?: unknown) {
    const key = `settings.signIn.fieldError.${code}`
    if (code === 'domain_taken') return t(key, { value: String(value ?? '') })
    return t(key, { defaultValue: '' }) || (field ? fieldErrorText(code) : '')
  }

  function onSaveError(e: unknown) {
    if (e instanceof ApiError) {
      if (e.is('SSO_NOT_VERIFIED')) return setBanner(t('settings.signIn.error.notVerified'))
      let placed = 0
      for (const f of e.fieldErrors) {
        const name = f.field.split('.').pop() as keyof Values
        const value = (f as { value?: unknown }).value
        setError(name, { type: 'server', message: fieldMessage(name, f.code, value) })
        placed += 1
      }
      if (placed) return setBanner(t('settings.signIn.error.checkFields'))
    }
    setBanner(errorText(e))
  }

  function onSubmit(v: Values) {
    setBanner(null)
    if (!s?.has_secret && !v.client_secret) {
      setError('client_secret', { type: 'server', message: t('settings.signIn.fieldError.required') })
      return
    }
    save.mutate(
      {
        provider: v.provider,
        client_id: v.client_id.trim(),
        // Only send a secret when a new one was typed; omitted keeps the stored one.
        ...(v.client_secret ? { client_secret: v.client_secret } : {}),
        ...(v.provider === 'microsoft' ? { tenant_id: v.tenant_id.trim() } : {}),
        ...(v.provider === 'oidc' ? { issuer: v.issuer.trim() } : {}),
        ...(v.scopes.trim() ? { scopes: v.scopes.trim() } : {}),
        domains: v.domains,
        enabled: v.enabled,
        sso_required: v.enabled && v.sso_required,
      },
      { onError: onSaveError },
    )
  }

  async function copy() {
    if (!s) return
    try {
      await navigator.clipboard.writeText(s.redirect_uri)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setBanner(t('settings.signIn.redirect.copyFailed'))
    }
  }

  const status = s?.status ?? 'not_set_up'
  const tenantRequired = provider === 'microsoft'

  return (
    <SettingsFrame title={t('settings.signIn.title')} subtitle={t('settings.signIn.subtitle')} query={query}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[status]}>{t(`settings.signIn.status.${status}`)}</Badge>
        {s?.verified_at && <span className="text-xs text-muted">{t('settings.signIn.status.verifiedAt', { when: formatDateTime(s.verified_at, me?.organization?.timezone) })}</span>}
      </div>

      {testBanner && (
        <p role={testBanner.ok ? 'status' : 'alert'} className={`rounded-(--radius) border p-3 text-sm ${testBanner.ok ? 'border-success/30 bg-success/5 text-success' : 'border-error/30 bg-error/5 text-error'}`}>
          {testBanner.text}
        </p>
      )}

      <form className="space-y-6" noValidate onSubmit={handleSubmit(onSubmit)}>
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}

        <Card title={t('settings.signIn.provider.title')}>
          <fieldset>
            <legend className="sr-only">{t('settings.signIn.provider.title')}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {PROVIDERS.map((p) => (
                <label key={p} className={`flex cursor-pointer flex-col gap-1 rounded-(--radius) border p-3 text-sm focus-within:ring-2 focus-within:ring-primary ${provider === p ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" className="accent-(--color-primary)" aria-label={t(`settings.signIn.provider.${p}`)} aria-describedby={`sso-provider-${p}-hint`} value={p} checked={provider === p} onChange={() => setValue('provider', p, { shouldDirty: true })} />
                    {t(`settings.signIn.provider.${p}`)}
                  </span>
                  <span id={`sso-provider-${p}-hint`} className="text-xs text-muted">{t(`settings.signIn.provider.${p}Hint`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {provider === 'microsoft' && (
            <Field label={t('settings.signIn.tenantId')} hint={t('settings.signIn.tenantIdHint')} autoComplete="off" error={errors.tenant_id?.message} {...register('tenant_id', { required: tenantRequired ? t('settings.signIn.fieldError.required') : false })} />
          )}
          {provider === 'oidc' && (
            <Field label={t('settings.signIn.issuer')} hint={t('settings.signIn.issuerHint')} placeholder={t('settings.signIn.issuerPlaceholder')} autoComplete="off" error={errors.issuer?.message} {...register('issuer', { required: t('settings.signIn.fieldError.required') })} />
          )}
          <Field label={t('settings.signIn.clientId')} autoComplete="off" error={errors.client_id?.message} {...register('client_id', { required: t('settings.signIn.fieldError.required') })} />
          <Field
            label={t('settings.signIn.clientSecret')}
            type="password"
            autoComplete="new-password"
            placeholder={s?.has_secret ? t('settings.signIn.secretSaved') : undefined}
            hint={s?.has_secret ? t('settings.writeOnly.set') : t('settings.writeOnly.unset')}
            error={errors.client_secret?.message}
            {...register('client_secret')}
          />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">{t('settings.signIn.advanced')}</summary>
            <div className="mt-3">
              <Field label={t('settings.signIn.scopes')} hint={t('settings.signIn.scopesHint')} placeholder={t('settings.signIn.scopesPlaceholder')} autoComplete="off" error={errors.scopes?.message} {...register('scopes')} />
            </div>
          </details>
        </Card>

        <Card title={t('settings.signIn.domains.title')}>
          <DomainInput value={domains} onChange={(next) => setValue('domains', next, { shouldDirty: true, shouldValidate: false })} error={errors.domains?.message as string | undefined} />
        </Card>

        <Card title={t('settings.signIn.redirect.title')}>
          <p className="text-sm text-muted">{t('settings.signIn.redirect.help')}</p>
          <div className="flex items-center gap-2">
            <input readOnly aria-label={t('settings.signIn.redirect.title')} value={s?.redirect_uri ?? ''} className="h-10 w-full rounded-(--radius) border border-border bg-bg px-3 font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" onClick={() => void copy()}>{copied ? t('settings.signIn.redirect.copied') : t('settings.signIn.redirect.copy')}</Button>
          </div>
        </Card>

        <Card title={t('settings.signIn.access.title')}>
          <Switch
            id="sso-enabled"
            label={t('settings.signIn.enable.label')}
            hint={t('settings.signIn.enable.hint')}
            checked={enabled}
            disabled={!verified && !enabled}
            disabledReason={s?.configured ? (isDirty ? t('settings.signIn.enable.saveFirst') : t('settings.signIn.enable.needsTest')) : t('settings.signIn.enable.needsSetup')}
            onChange={(v) => {
              setValue('enabled', v, { shouldDirty: true })
              if (!v) setValue('sso_required', false, { shouldDirty: true })
            }}
          />
          <Switch
            id="sso-required"
            label={t('settings.signIn.required.label')}
            hint={t('settings.signIn.required.hint')}
            checked={required}
            disabled={!enabled}
            disabledReason={t('settings.signIn.required.needsEnabled')}
            onChange={(v) => setValue('sso_required', v, { shouldDirty: true })}
          />
          {required && <p role="note" className="rounded-(--radius) border border-warning/30 bg-warning/5 p-3 text-sm text-warning">{t('settings.signIn.required.warning')}</p>}
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.isPending}>{t('settings.save')}</Button>
          <Button variant="outline" loading={test.isPending} disabled={!s?.configured || isDirty} onClick={() => { setTestBanner(null); test.mutate() }}>
            {t('settings.signIn.test.button')}
          </Button>
          {s?.configured && <Button variant="danger" className="ml-auto" onClick={() => setRemoving(true)}>{t('settings.signIn.remove.button')}</Button>}
        </div>
        <p className="text-xs text-muted">{!s?.configured ? t('settings.signIn.test.needsSave') : isDirty ? t('settings.signIn.test.saveFirst') : t('settings.signIn.test.explain')}</p>
      </form>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t('settings.signIn.remove.title')}
        body={t('settings.signIn.remove.body')}
        confirmLabel={t('settings.signIn.remove.confirm')}
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </SettingsFrame>
  )
}
