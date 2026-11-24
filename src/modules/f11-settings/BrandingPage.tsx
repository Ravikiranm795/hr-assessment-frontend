import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { BACKGROUNDS, COLOR_COMBOS, applyBranding, clearLegacyBranding, contrastRatio, fontFamily, matchCombo, pageThemeOf, readLegacyBranding, type BrandingOut, type ColorCombo } from '@/core/branding'
import { resetTheme } from '@/core/theme'
import { BrandingPreview } from './BrandingPreview'
import { Card, ColorField, Select, SettingsFrame } from './common'

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
const AA = 4.5
/** An optional color is fine when empty or a full hex code. */
const okOpt = (v: string) => v === '' || HEX.test(v)
/** A pair that has both colors must reach WCAG AA; otherwise nothing to check yet. */
const pairOk = (bg: string, text: string) => !(HEX.test(bg) && HEX.test(text)) || contrastRatio(bg, text) >= AA
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
  const [ptext, setPtext] = useState('') // page text color
  const [sideBg, setSideBg] = useState('') // '' = not customised
  const [sideText, setSideText] = useState('')
  const [topBg, setTopBg] = useState('')
  const [topText, setTopText] = useState('')
  const [validation, setValidation] = useState<Validation | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [legacyFound, setLegacyFound] = useState(false)

  const data = query.data
  useEffect(() => {
    if (!data) return
    // One-time migration: the server has no theme yet but this browser still holds the old local one.
    const serverHasTheme = !!(data.page_theme || data.nav_theme || data.background_color || data.side_nav_color || data.top_nav_color || data.page_text_color)
    const legacy = serverHasTheme ? null : readLegacyBranding(orgId)
    setLegacyFound(!!legacy)
    const src = legacy ?? data
    const page = src.page_theme ?? ''
    setPrimary(data.primary_color ?? '')
    setAccent(data.accent_color ?? '')
    setBgStyle(data.background_style ?? '')
    setBg(src.background_color ?? (page ? pageThemeOf(page).bg : (BACKGROUNDS[data.background_style ?? ''] ?? '#f5fbfa')))
    setFont(data.font_key ?? '')
    setNavTheme(src.nav_theme ?? '')
    setPageTheme(page)
    setPtext(data.page_text_color ?? pageThemeOf(page).text)
    setSideBg(data.side_nav_color ?? '')
    setSideText(data.side_nav_text_color ?? '')
    setTopBg(data.top_nav_color ?? '')
    setTopText(data.top_nav_text_color ?? '')
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

  const pageText = HEX.test(ptext) ? ptext : pageThemeOf(pageTheme).text // the page text color the background has to stay readable against
  const bgRatio = HEX.test(bg) ? contrastRatio(bg, pageText) : 0
  const bgCheck: Check | undefined = HEX.test(bg) ? { color: bg, text_color: pageText, ratio: Math.round(bgRatio * 10) / 10, minimum: 4.5, passes: bgRatio >= 4.5 } : undefined

  const save = useMutation({
    mutationFn: () => {
      // A custom background is sent only when it differs from the page theme / preset color; null clears it.
      const preset = BACKGROUNDS[bgStyle]
      const base = pageThemeOf(pageTheme).bg.toLowerCase()
      const custom = bg.toLowerCase() !== base && preset?.toLowerCase() !== bg.toLowerCase()
      return api.put<Branding | undefined>(PATH, {
        primary_color: primary,
        accent_color: accent,
        background_style: bgStyle || undefined,
        font_key: font || undefined,
        page_theme: pageTheme || null,
        nav_theme: navTheme || null,
        background_color: custom ? bg : null,
        page_text_color: ptext && ptext.toLowerCase() !== pageThemeOf(pageTheme).text.toLowerCase() ? ptext : null,
        side_nav_color: sideBg || null,
        side_nav_text_color: sideText || null,
        top_nav_color: topBg || null,
        top_nav_text_color: topText || null,
      })
    },
    onSuccess: (saved) => {
      clearLegacyBranding(orgId)
      setLegacyFound(false)
      // The saved organization branding drives the live theme.
      if (saved && typeof saved === 'object' && 'primary_color' in saved) {
        resetTheme()
        applyBranding(saved)
      }
      toast.success(t('settings.saved'))
      refreshTheme()
    },
    onError: (e) => setBanner(errorText(e)),
  })
  const reset = useMutation({
    mutationFn: () => api.post(`${PATH}/reset`),
    onSuccess: () => {
      clearLegacyBranding(orgId)
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

  const valid =
    HEX.test(primary) && HEX.test(accent) && validation?.valid !== false && bgCheck?.passes === true &&
    okOpt(ptext) && okOpt(sideBg) && okOpt(sideText) && okOpt(topBg) && okOpt(topText) &&
    pairOk(sideBg, sideText) && pairOk(topBg, topText) && pairOk(bg, ptext)
  const clearPage = () => { setBg(pageThemeOf(pageTheme).bg); setPtext(pageThemeOf(pageTheme).text); setBgStyle('') }
  // Picking a combination fills every colour field and clears the legacy theme keys (sent as null on save).
  const applyCombo = (c: ColorCombo) => {
    setPrimary(c.primary)
    setAccent(c.accent)
    setBg(c.bg)
    setBgStyle('')
    setPtext(c.text)
    setSideBg(c.sideBg)
    setSideText(c.sideText)
    setTopBg(c.topBg)
    setTopText(c.topText)
    setPageTheme('')
    setNavTheme('')
  }
  const activeCombo = pageTheme || navTheme ? undefined : matchCombo({ primary, accent, bg, text: ptext, sideBg, sideText, topBg, topText })
  const family = useMemo(() => fontFamily(font) ?? "'Inter Variable', system-ui, sans-serif", [font])
  const theme = {
    primary: HEX.test(primary) ? primary : '#09715e',
    accent: HEX.test(accent) ? accent : '#e8836b',
    primaryContrast: validation?.checks.primary?.text_color ?? '#ffffff',
    accentContrast: validation?.checks.accent?.text_color ?? '#111827',
    background: HEX.test(bg) ? bg : '#f5fbfa',
    fontFamily: family,
    side: { preset: navTheme, color: sideBg, text: sideText },
    top: { preset: navTheme, color: topBg, text: topText },
    pageText: ptext,
    pageTheme,
    logoUrl: data?.logo_url ?? null,
    orgName: me?.organization?.name ?? t('app.name'),
  }

  return (
    <SettingsFrame wide title={t('settings.branding.title')} subtitle={t('settings.branding.subtitle')} query={query}>
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setBanner(null); save.mutate() }}>
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
        {legacyFound && <p role="status" className="rounded-(--radius) border border-border bg-surface p-3 text-sm">{t('settings.branding.legacyFound')}</p>}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card title={t('settings.branding.combos')}>
              <p className="text-xs text-muted">{t('settings.branding.combosHint')}</p>
              <ComboGallery value={activeCombo?.key ?? ''} onPick={applyCombo} />
              <p role="status" className="text-xs font-medium">
                {activeCombo ? t('settings.branding.comboActive', { name: t(`settings.branding.combo_${activeCombo.key}`) }) : t('settings.branding.comboCustom')}
              </p>
            </Card>

            <Card>
              <ColorField id="brand-primary" label={t('settings.branding.primary')} value={primary} onChange={setPrimary} check={validation?.checks.primary} />
              <ColorField id="brand-accent" label={t('settings.branding.accent')} value={accent} onChange={setAccent} check={validation?.checks.accent} />
              <Select id="brand-font" label={t('settings.branding.font')} value={font} onChange={setFont}>
                {fonts.data?.fonts.map((f) => (
                  <option key={f.key} value={f.key} style={{ fontFamily: fontFamily(f.key) ?? undefined }}>{f.label}</option>
                ))}
              </Select>
            </Card>

            <Card title={t('settings.branding.pageColors')}>
              <ColorField id="brand-bg" label={t('settings.branding.background')} value={bg} onChange={(v) => { setBg(v); setBgStyle('') }} check={bgCheck} />
              <div role="radiogroup" aria-label={t('settings.branding.backgroundPreset')} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{t('settings.branding.backgroundPreset')}</span>
                {fonts.data?.background_styles.map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={bgStyle === b}
                    onClick={() => { setBgStyle(b); const c = BACKGROUNDS[b]; if (c) setBg(c.toUpperCase()) }}
                    className={`flex items-center gap-1.5 rounded-(--radius) border px-2 py-1 text-xs ${bgStyle === b ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                  >
                    <span className="size-4 rounded border border-border" style={{ background: BACKGROUNDS[b] ?? 'transparent' }} aria-hidden />
                    {t(`settings.branding.bg_${b}`, { defaultValue: b })}
                  </button>
                ))}
              </div>
              <ColorField id="brand-page-text" label={t('settings.branding.pageText')} value={ptext} onChange={setPtext} against={bg} againstLabel={t('settings.branding.onPage')} />
              <Button variant="ghost" size="sm" onClick={clearPage}>{t('settings.branding.clearCustom')}</Button>
            </Card>

            <Card title={t('settings.branding.sideNav')}>
              <ColorField id="brand-side-bg" label={t('settings.branding.sideColor')} value={sideBg} onChange={setSideBg} optional />
              <ColorField id="brand-side-text" label={t('settings.branding.sideText')} value={sideText} onChange={setSideText} optional against={sideBg} againstLabel={t('settings.branding.onSide')} />
              <Button variant="ghost" size="sm" onClick={() => { setSideBg(''); setSideText('') }}>{t('settings.branding.clearCustom')}</Button>
            </Card>

            <Card title={t('settings.branding.topNav')}>
              <ColorField id="brand-top-bg" label={t('settings.branding.topColor')} value={topBg} onChange={setTopBg} optional />
              <ColorField id="brand-top-text" label={t('settings.branding.topText')} value={topText} onChange={setTopText} optional against={topBg} againstLabel={t('settings.branding.onTop')} />
              <Button variant="ghost" size="sm" onClick={() => { setTopBg(''); setTopText('') }}>{t('settings.branding.clearCustom')}</Button>
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

/** 11 cards, each a miniature (top bar, side bar, page, primary and accent buttons) with the combination name. */
function ComboGallery({ value, onPick }: { value: string; onPick: (c: ColorCombo) => void }) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={t('settings.branding.combos')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {COLOR_COMBOS.map((c) => {
        const active = c.key === value
        const name = t(`settings.branding.combo_${c.key}`)
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            onClick={() => onPick(c)}
            className={`flex flex-col gap-1 rounded-(--radius) border p-1.5 text-left text-[11px] font-medium ${active ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
          >
            <span className="flex h-14 w-full flex-col overflow-hidden rounded border border-border" style={{ background: c.bg }} aria-hidden>
              <span className="h-2.5 w-full" style={{ background: c.topBg }} />
              <span className="flex min-h-0 flex-1">
                <span className="w-1/5" style={{ background: c.sideBg }} />
                <span className="flex flex-1 items-center justify-center gap-1 p-1" style={{ color: c.text }}>
                  <span className="h-3 w-5 rounded-sm" style={{ background: c.primary }} />
                  <span className="h-3 w-5 rounded-sm" style={{ background: c.accent }} />
                </span>
              </span>
            </span>
            {name}
          </button>
        )
      })}
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
