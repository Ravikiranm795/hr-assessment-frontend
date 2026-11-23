import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { BACKGROUNDS, MIXED_THEMES, NAV_THEMES, PAGE_THEMES, contrastRatio, fontFamily, loadLocalBranding, navTokens, pageThemeOf, pageTokens, saveLocalBranding, type BrandingOut } from '@/core/branding'
import { applyTheme, resetTheme } from '@/core/theme'
import { BrandingPreview } from './BrandingPreview'
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
const FAVICON_TYPES = { 'image/png': 'PNG', 'image/jpeg': 'JPG / JPEG', 'image/svg+xml': 'SVG', 'image/x-icon': 'ICO', 'image/vnd.microsoft.icon': 'ICO', 'image/webp': 'WebP' }
const LOGO_TYPES = { 'image/png': 'PNG', 'image/jpeg': 'JPG / JPEG', 'image/svg+xml': 'SVG', 'image/webp': 'WebP' }

export function BrandingPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const client = useQueryClient()
  const { me } = useAuth()
  const orgId = me?.organization?.id
  const query = useQuery({ queryKey: ['settings', PATH], queryFn: () => api.get<Branding>(PATH) })
  const fonts = useQuery({ queryKey: ['settings', `${PATH}/fonts`], queryFn: () => api.get<Fonts>(`${PATH}/fonts`) })

  const [primary, setPrimary] = useState('')
  const [accent, setAccent] = useState('')
  const [bgStyle, setBgStyle] = useState('')
  const [bg, setBg] = useState('')
  const [font, setFont] = useState('')
  const [navTheme, setNavTheme] = useState('') // '' = nothing picked yet (starter look)
  const [pageTheme, setPageTheme] = useState('')
  const [validation, setValidation] = useState<Validation | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const data = query.data
  useEffect(() => {
    if (!data) return
    const local = loadLocalBranding(orgId)
    setPrimary(data.primary_color ?? '')
    setAccent(data.accent_color ?? '')
    setBgStyle(data.background_style ?? '')
    setBg(local.background_color ?? (local.page_theme ? pageThemeOf(local.page_theme).bg : (BACKGROUNDS[data.background_style ?? ''] ?? '#f5fbfa')))
    setFont(data.font_key ?? '')
    setNavTheme(local.nav_theme ?? '')
    setPageTheme(local.page_theme ?? '')
  }, [data, orgId])

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

  const pageText = pageThemeOf(pageTheme).text // the page text color the background has to stay readable against
  const bgRatio = HEX.test(bg) ? contrastRatio(bg, pageText) : 0
  const bgCheck: Check | undefined = HEX.test(bg) ? { color: bg, text_color: pageText, ratio: Math.round(bgRatio * 10) / 10, minimum: 4.5, passes: bgRatio >= 4.5 } : undefined

  const save = useMutation({
    mutationFn: () => api.put(PATH, { primary_color: primary, accent_color: accent, background_style: bgStyle || undefined, font_key: font || undefined }),
    onSuccess: () => {
      // Page background color and navigation theme have no server field yet (API_GAPS.md): kept in this browser.
      const preset = BACKGROUNDS[bgStyle]
      const base = pageThemeOf(pageTheme).bg.toLowerCase()
      const custom = bg.toLowerCase() !== base && preset?.toLowerCase() !== bg.toLowerCase()
      saveLocalBranding(orgId, { background_color: custom ? bg : undefined, page_theme: pageTheme || undefined, nav_theme: navTheme || undefined })
      applyTheme({ ...pageTokens(pageTheme), '--color-bg': bg, ...navTokens(navTheme) })
      toast.success(t('settings.saved'))
      refreshTheme()
    },
    onError: (e) => setBanner(errorText(e)),
  })
  const reset = useMutation({
    mutationFn: () => api.post(`${PATH}/reset`),
    onSuccess: () => {
      saveLocalBranding(orgId, null)
      resetTheme()
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
    mutationFn: async ({ kind, file }: { kind: 'logo' | 'favicon'; file: File }) => {
      const form = new FormData()
      // The server stores PNG, JPEG, WebP (and ICO for favicons), so an SVG is turned into a PNG first.
      form.append('file', file.type === 'image/svg+xml' ? await svgToPng(file, kind === 'favicon' ? 256 : 512) : file)
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
  const pick = (kind: 'logo' | 'favicon', file: File) => {
    const allowed: Record<string, string> = kind === 'favicon' ? FAVICON_TYPES : LOGO_TYPES
    const byName = /\.svg$/i.test(file.name) ? 'image/svg+xml' : /\.ico$/i.test(file.name) ? 'image/x-icon' : file.type
    if (!allowed[byName]) {
      toast.info(t('settings.branding.typeNotSupported', { type: file.type || file.name.split('.').pop(), supported: [...new Set(Object.values(allowed))].join(', ') }))
      return
    }
    upload.mutate({ kind, file: byName === file.type ? file : new File([file], file.name, { type: byName }) })
  }

  const valid = HEX.test(primary) && HEX.test(accent) && validation?.valid !== false && bgCheck?.passes === true
  const family = useMemo(() => fontFamily(font) ?? "'Inter Variable', system-ui, sans-serif", [font])
  const theme = {
    primary: HEX.test(primary) ? primary : '#09715e',
    accent: HEX.test(accent) ? accent : '#e8836b',
    primaryContrast: validation?.checks.primary?.text_color ?? '#ffffff',
    accentContrast: validation?.checks.accent?.text_color ?? '#111827',
    background: HEX.test(bg) ? bg : '#f5fbfa',
    fontFamily: family,
    navTheme,
    pageTheme,
    logoUrl: data?.logo_url ?? null,
    orgName: me?.organization?.name ?? t('app.name'),
  }

  return (
    <SettingsFrame wide title={t('settings.branding.title')} subtitle={t('settings.branding.subtitle')} query={query}>
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setBanner(null); save.mutate() }}>
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <ColorField id="brand-primary" label={t('settings.branding.primary')} value={primary} onChange={setPrimary} check={validation?.checks.primary} />
              <ColorField id="brand-accent" label={t('settings.branding.accent')} value={accent} onChange={setAccent} check={validation?.checks.accent} />
              <ColorField id="brand-bg" label={t('settings.branding.background')} value={bg} onChange={setBg} check={bgCheck} />
              <Select id="brand-bg-style" label={t('settings.branding.backgroundPreset')} value={bgStyle} onChange={(v) => { setBgStyle(v); const c = BACKGROUNDS[v]; if (c) setBg(c) }}>
                {fonts.data?.background_styles.map((b) => (
                  <option key={b} value={b}>{t(`settings.branding.bg_${b}`, { defaultValue: b })}</option>
                ))}
              </Select>
              <Select id="brand-font" label={t('settings.branding.font')} value={font} onChange={setFont}>
                {fonts.data?.fonts.map((f) => (
                  <option key={f.key} value={f.key} style={{ fontFamily: fontFamily(f.key) ?? undefined }}>{f.label}</option>
                ))}
              </Select>
            </Card>

            <Card title={t('settings.branding.pageTheme')}>
              <p className="text-xs text-muted">{t('settings.branding.pageThemeHint')}</p>
              <ThemeGrid
                label={t('settings.branding.pageTheme')}
                value={pageTheme}
                onChange={(k) => { setPageTheme(k); setBg(pageThemeOf(k).bg) }}
                items={PAGE_THEMES.map((p) => ({ key: p.key, bg: p.bg, text: p.text, name: t(`settings.branding.page_${p.key}`) }))}
              />
            </Card>

            <Card title={t('settings.branding.navTheme')}>
              <p className="text-xs text-muted">{t('settings.branding.navThemeHint')}</p>
              <ThemeGrid label={t('settings.branding.navTheme')} value={navTheme} onChange={setNavTheme} items={NAV_THEMES.map((n) => ({ key: n.key, bg: n.bg, text: n.text, name: t(`settings.branding.nav_${n.key}`) }))} />
            </Card>

            <Card title={t('settings.branding.mixedTheme')}>
              <p className="text-xs text-muted">{t('settings.branding.mixedThemeHint')}</p>
              <ThemeGrid
                label={t('settings.branding.mixedTheme')}
                value={MIXED_THEMES.find((m) => m.page === pageTheme && m.nav === navTheme)?.key ?? ''}
                onChange={(k) => {
                  const m = MIXED_THEMES.find((x) => x.key === k)
                  if (!m) return
                  setPageTheme(m.page)
                  setNavTheme(m.nav)
                  setBg(pageThemeOf(m.page).bg)
                }}
                items={MIXED_THEMES.map((m) => {
                  const p = pageThemeOf(m.page)
                  const n = NAV_THEMES.find((x) => x.key === m.nav)!
                  return { key: m.key, bg: p.bg, text: p.text, navBg: n.bg, navText: n.text, name: t(`settings.branding.mixed_${m.key}`) }
                })}
              />
            </Card>
          </div>

          <div className="lg:sticky lg:top-0 lg:self-start">
            <Card title={t('settings.branding.preview')}>
              <BrandingPreview theme={theme} />
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={save.isPending} disabled={!valid}>{t('settings.save')}</Button>
          <Button variant="outline" onClick={() => setResetOpen(true)}>{t('settings.branding.reset')}</Button>
        </div>
      </form>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t('settings.branding.logo')}>
          <ImageUpload id="logo-file" url={data?.logo_url ?? null} label={t('settings.branding.upload')} empty={t('settings.branding.noLogo')} busy={upload.isPending} types={LOGO_TYPES} onFile={(file) => pick('logo', file)} />
        </Card>
        <Card title={t('settings.branding.favicon')}>
          <ImageUpload id="favicon-file" url={data?.favicon_url ?? null} label={t('settings.branding.upload')} empty={t('settings.branding.noLogo')} busy={upload.isPending} types={FAVICON_TYPES} onFile={(file) => pick('favicon', file)} />
        </Card>
      </div>

      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title={t('settings.branding.resetTitle')} body={t('settings.branding.resetBody')} confirmLabel={t('settings.branding.reset')} danger loading={reset.isPending} onConfirm={() => reset.mutate()} />
    </SettingsFrame>
  )
}

function ThemeGrid({ label, value, onChange, items }: { label: string; value: string; onChange: (key: string) => void; items: { key: string; bg: string; text: string; name: string; navBg?: string; navText?: string }[] }) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
      {items.map((n) => {
        const active = n.key === value
        return (
          <button
            key={n.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(n.key)}
            className={`flex flex-col items-center gap-1 rounded-(--radius) border p-1.5 text-[11px] ${active ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
          >
            <span className="flex h-9 w-full overflow-hidden rounded border border-border text-sm font-semibold" style={{ background: n.bg, color: n.text }}>
              {n.navBg && <span className="w-1/3" style={{ background: n.navBg, color: n.navText }} />}
              <span className="flex flex-1 items-center justify-center">{t('settings.branding.sample')}</span>
            </span>
            {n.name}
          </button>
        )
      })}
    </div>
  )
}

function ColorField({ id, label, value, onChange, check }: { id: string; label: string; value: string; onChange: (v: string) => void; check?: Check }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
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

function ImageUpload({ id, url, label, empty, busy, types, onFile }: { id: string; url: string | null; label: string; empty: string; busy: boolean; types: Record<string, string>; onFile: (file: File) => void }) {
  const { t } = useTranslation()
  const names = [...new Set(Object.values(types))].join(', ')
  // The picker only lists the supported types; ICO also by extension because browsers report it inconsistently.
  const accept = [...Object.keys(types), ...(types['image/x-icon'] ? ['.ico'] : []), '.svg'].join(',')
  return (
    <div className="flex items-center gap-4">
      {url ? <img src={url} alt="" className="size-16 rounded border border-border bg-bg object-contain" /> : <span className="flex size-16 items-center justify-center rounded border border-dashed border-border text-xs text-muted">{empty}</span>}
      <div className="space-y-1">
        <label htmlFor={id} className="inline-flex h-10 cursor-pointer items-center rounded-(--radius) border border-border bg-surface px-4 text-sm font-medium hover:bg-bg">
          {busy ? '…' : label}
        </label>
        <p className="text-xs text-muted">{t('settings.branding.supported', { types: names })}</p>
        <input id={id} type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      </div>
    </div>
  )
}

/** Draw an SVG onto a canvas and hand back a PNG, longest side `max` px. */
async function svgToPng(file: File, max: number): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok()
      img.onerror = () => fail(new Error('svg'))
      img.src = url
    })
    const w = img.naturalWidth || max
    const h = img.naturalHeight || max
    const k = max / Math.max(w, h)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * k))
    canvas.height = Math.max(1, Math.round(h * k))
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!blob) throw new Error('svg')
    return new File([blob], `${file.name.replace(/\.svg$/i, '')}.png`, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
