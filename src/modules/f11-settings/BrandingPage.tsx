import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import type { BrandingOut } from '@/core/branding'
import { Card, Select, SettingsFrame } from './common'

interface Fonts {
  fonts: { key: string; label: string }[]
  background_styles: string[]
}
interface Check {
  color: string
  text_color: string
  ratio: number
  minimum: number
  passes: boolean
}
interface Validation {
  valid: boolean
  checks: { primary?: Check; accent?: Check }
}
type Branding = BrandingOut & { logo_url: string | null; favicon_url: string | null }

const PATH = '/api/v1/org/branding'
const HEX = /^#[0-9a-fA-F]{6}$/

export function BrandingPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['settings', PATH], queryFn: () => api.get<Branding>(PATH) })
  const fonts = useQuery({ queryKey: ['settings', `${PATH}/fonts`], queryFn: () => api.get<Fonts>(`${PATH}/fonts`) })

  const [primary, setPrimary] = useState('')
  const [accent, setAccent] = useState('')
  const [bg, setBg] = useState('')
  const [font, setFont] = useState('')
  const [validation, setValidation] = useState<Validation | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const data = query.data
  useEffect(() => {
    if (!data) return
    setPrimary(data.primary_color ?? '')
    setAccent(data.accent_color ?? '')
    setBg(data.background_style ?? '')
    setFont(data.font_key ?? '')
  }, [data])

  const refreshTheme = () => {
    void client.invalidateQueries({ queryKey: ['settings', PATH] })
    void client.invalidateQueries({ queryKey: ['branding'] }) // the app shell re-applies the theme
  }

  // Live contrast pre-check (spec 8.6). The server stays the authority on save.
  const validate = useMutation({ mutationFn: (body: object) => api.post<Validation>(`${PATH}/validate`, body), onSuccess: setValidation })
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!HEX.test(primary) || !HEX.test(accent)) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => validate.mutate({ primary_color: primary, accent_color: accent }), 350)
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary, accent])

  const save = useMutation({
    mutationFn: () => api.put(PATH, { primary_color: primary, accent_color: accent, background_style: bg, font_key: font }),
    onSuccess: () => {
      toast.success(t('settings.saved'))
      refreshTheme()
    },
    onError: (e) => setBanner(errorText(e)),
  })
  const reset = useMutation({
    mutationFn: () => api.post(`${PATH}/reset`),
    onSuccess: () => {
      toast.success(t('settings.branding.resetDone'))
      setResetOpen(false)
      refreshTheme()
    },
    onError: (e) => {
      setResetOpen(false)
      toast.error(e)
    },
  })
  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: 'logo' | 'favicon'; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      return api.upload(`${PATH}/${kind}`, form)
    },
    onSuccess: () => {
      toast.success(t('settings.branding.uploaded'))
      refreshTheme()
    },
    onError: (e) => {
      const reason = e instanceof ApiError && typeof e.details.reason === 'string' ? e.details.reason : errorText(e)
      toast.info(t('settings.branding.uploadFail', { reason }))
    },
  })

  const valid = HEX.test(primary) && HEX.test(accent) && validation?.valid !== false
  const previewStyle = { '--color-primary': primary, '--color-accent': accent, '--color-primary-contrast': validation?.checks.primary?.text_color ?? '#ffffff', '--color-accent-contrast': validation?.checks.accent?.text_color ?? '#111827' } as CSSProperties

  return (
    <SettingsFrame title={t('settings.branding.title')} subtitle={t('settings.branding.subtitle')} query={query}>
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setBanner(null); save.mutate() }}>
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
        <Card>
          <ColorField id="brand-primary" label={t('settings.branding.primary')} value={primary} onChange={setPrimary} check={validation?.checks.primary} />
          <ColorField id="brand-accent" label={t('settings.branding.accent')} value={accent} onChange={setAccent} check={validation?.checks.accent} />
          <Select id="brand-bg" label={t('settings.branding.background')} value={bg} onChange={setBg}>
            {fonts.data?.background_styles.map((b) => (
              <option key={b} value={b}>{t(`settings.branding.bg_${b}`, { defaultValue: b })}</option>
            ))}
          </Select>
          <Select id="brand-font" label={t('settings.branding.font')} value={font} onChange={setFont}>
            {fonts.data?.fonts.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </Select>
        </Card>

        <Card title={t('settings.branding.preview')}>
          <div style={previewStyle} className="flex flex-wrap items-center gap-3 rounded-(--radius) border border-border bg-bg p-4">
            <span className="rounded-(--radius) px-4 py-2 text-sm font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)' }}>
              {t('settings.branding.previewButton')}
            </span>
            <span className="rounded-(--radius) px-4 py-2 text-sm font-medium" style={{ background: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}>
              {t('settings.branding.previewAccent')}
            </span>
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={save.isPending} disabled={!valid}>{t('settings.save')}</Button>
          <Button variant="outline" onClick={() => setResetOpen(true)}>{t('settings.branding.reset')}</Button>
        </div>
      </form>

      <Card title={t('settings.branding.logo')}>
        <ImageUpload id="logo-file" url={data?.logo_url ?? null} label={t('settings.branding.upload')} empty={t('settings.branding.noLogo')} busy={upload.isPending} onFile={(file) => upload.mutate({ kind: 'logo', file })} />
      </Card>
      <Card title={t('settings.branding.favicon')}>
        <ImageUpload id="favicon-file" url={data?.favicon_url ?? null} label={t('settings.branding.upload')} empty={t('settings.branding.noLogo')} busy={upload.isPending} onFile={(file) => upload.mutate({ kind: 'favicon', file })} />
      </Card>

      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title={t('settings.branding.resetTitle')} body={t('settings.branding.resetBody')} confirmLabel={t('settings.branding.reset')} danger loading={reset.isPending} onConfirm={() => reset.mutate()} />
    </SettingsFrame>
  )
}

function ColorField({ id, label, value, onChange, check }: { id: string; label: string; value: string; onChange: (v: string) => void; check?: Check }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" aria-label={label} className="h-10 w-12 cursor-pointer rounded border border-border bg-surface" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input id={id} className="h-10 w-32 rounded-(--radius) border border-border bg-surface px-3 font-mono text-sm" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} aria-invalid={!HEX.test(value) || undefined} />
        {check && (
          <Badge tone={check.passes ? 'success' : 'error'}>
            {check.passes ? t('settings.branding.contrastPass', { ratio: check.ratio }) : t('settings.branding.contrastFail', { ratio: check.ratio, min: check.minimum })}
          </Badge>
        )}
      </div>
    </div>
  )
}

function ImageUpload({ id, url, label, empty, busy, onFile }: { id: string; url: string | null; label: string; empty: string; busy: boolean; onFile: (file: File) => void }) {
  return (
    <div className="flex items-center gap-4">
      {url ? <img src={url} alt="" className="size-16 rounded border border-border bg-bg object-contain" /> : <span className="flex size-16 items-center justify-center rounded border border-dashed border-border text-xs text-muted">{empty}</span>}
      <div>
        <label htmlFor={id} className="inline-flex h-10 cursor-pointer items-center rounded-(--radius) border border-border bg-surface px-4 text-sm font-medium hover:bg-bg">
          {busy ? '…' : label}
        </label>
        <input id={id} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      </div>
    </div>
  )
}
