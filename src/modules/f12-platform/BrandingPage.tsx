import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { Card, PageHeader, QueryBlock } from './common'
import { checkContrast, HEX, MIN_CONTRAST, type ContrastCheck } from './contrast'
import type { PlatformBranding } from './types'

const PATH = '/api/v1/platform/branding'
// Curated lists from the backend schema (BrandingIn): the platform API has no /fonts endpoint.
const BACKGROUNDS = ['mint', 'plain_white', 'soft_gray', 'navy_band'] as const
const FONTS = ['inter', 'source_sans_3', 'nunito_sans', 'ibm_plex_sans', 'lato', 'merriweather'] as const

/** Isolated theme for the super admin screens and the login page (spec F12). Never touches an organization theme. */
export function BrandingPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['platform', 'branding'], queryFn: () => api.get<PlatformBranding>(PATH) })

  // Edits are kept as a draft over the saved theme, so the form needs no sync effect.
  const [draft, setDraft] = useState<Partial<Record<'primary' | 'accent' | 'bg' | 'font', string>>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const data = query.data
  const primary = draft.primary ?? data?.primary_color ?? ''
  const accent = draft.accent ?? data?.accent_color ?? ''
  const bg = draft.bg ?? data?.background_style ?? ''
  const font = draft.font ?? data?.font_key ?? ''
  const setPrimary = (v: string) => setDraft((d) => ({ ...d, primary: v }))
  const setAccent = (v: string) => setDraft((d) => ({ ...d, accent: v }))
  const setBg = (v: string) => setDraft((d) => ({ ...d, bg: v }))
  const setFont = (v: string) => setDraft((d) => ({ ...d, font: v }))

  const refreshTheme = () => {
    void client.invalidateQueries({ queryKey: ['platform', 'branding'] })
    void client.invalidateQueries({ queryKey: ['branding'] }) // the app shell re-applies the theme
  }

  const primaryCheck = HEX.test(primary) ? checkContrast(primary) : null
  const accentCheck = HEX.test(accent) ? checkContrast(accent) : null
  const valid = primaryCheck?.passes === true && accentCheck?.passes === true

  const save = useMutation({
    mutationFn: () => api.put(PATH, { primary_color: primary.toUpperCase(), accent_color: accent.toUpperCase(), background_style: bg, font_key: font }),
    onSuccess: () => {
      toast.success(t('platform.branding.saved'))
      refreshTheme()
    },
    onError: (e) => setBanner(errorText(e)),
  })
  const reset = useMutation({
    mutationFn: () => api.post(`${PATH}/reset`),
    onSuccess: () => {
      toast.success(t('platform.branding.resetDone'))
      setDraft({})
      setResetOpen(false)
      refreshTheme()
    },
    onError: (e) => {
      setResetOpen(false)
      toast.error(e)
    },
  })

  const previewStyle = {
    '--color-primary': primary,
    '--color-accent': accent,
    '--color-primary-contrast': primaryCheck?.textColor ?? '#ffffff',
    '--color-accent-contrast': accentCheck?.textColor ?? '#111827',
  } as CSSProperties

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('platform.branding.title')} subtitle={t('platform.branding.subtitle')} />
      <QueryBlock query={query}>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            setBanner(null)
            save.mutate()
          }}
        >
          {banner && (
            <p role="alert" className="text-sm text-error">
              {banner}
            </p>
          )}
          <Card>
            <ColorField id="platform-primary" label={t('platform.branding.primary')} value={primary} onChange={setPrimary} check={primaryCheck} />
            <ColorField id="platform-accent" label={t('platform.branding.accent')} value={accent} onChange={setAccent} check={accentCheck} />
            <SelectField id="platform-bg" label={t('platform.branding.background')} value={bg} onChange={setBg}>
              {BACKGROUNDS.map((b) => (
                <option key={b} value={b}>
                  {t(`platform.branding.bg.${b}`)}
                </option>
              ))}
            </SelectField>
            <SelectField id="platform-font" label={t('platform.branding.font')} value={font} onChange={setFont}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {t(`platform.branding.fonts.${f}`)}
                </option>
              ))}
            </SelectField>
          </Card>

          <Card title={t('platform.branding.preview')}>
            <div style={previewStyle} className="flex flex-wrap items-center gap-3 rounded-(--radius) border border-border bg-bg p-4">
              <span className="rounded-(--radius) px-4 py-2 text-sm font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)' }}>
                {t('platform.branding.previewButton')}
              </span>
              <span className="rounded-(--radius) px-4 py-2 text-sm font-medium" style={{ background: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}>
                {t('platform.branding.previewAccent')}
              </span>
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={save.isPending} disabled={!valid}>
              {t('platform.branding.save')}
            </Button>
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              {t('platform.branding.reset')}
            </Button>
          </div>
        </form>

        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title={t('platform.branding.resetTitle')}
          body={t('platform.branding.resetBody')}
          confirmLabel={t('platform.branding.reset')}
          danger
          loading={reset.isPending}
          onConfirm={() => reset.mutate()}
        />
      </QueryBlock>
    </div>
  )
}

function ColorField({ id, label, value, onChange, check }: { id: string; label: string; value: string; onChange: (v: string) => void; check: ContrastCheck | null }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input type="color" aria-label={t('platform.branding.picker', { label })} className="h-10 w-12 cursor-pointer rounded border border-border bg-surface" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input id={id} className="h-10 w-32 rounded-(--radius) border border-border bg-surface px-3 font-mono text-sm" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} aria-invalid={!HEX.test(value) || undefined} />
        {check && (
          <Badge tone={check.passes ? 'success' : 'error'}>
            {check.passes ? t('platform.branding.contrastPass', { ratio: check.ratio }) : t('platform.branding.contrastFail', { ratio: check.ratio, min: MIN_CONTRAST })}
          </Badge>
        )}
      </div>
    </div>
  )
}

function SelectField({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select id={id} className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  )
}
