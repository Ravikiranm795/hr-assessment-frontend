import { applyTheme, setFavicon } from './theme'

/** Shape of GET /api/v1/org/branding and /api/v1/platform/branding (read live 2026-11-17). */
export interface BrandingOut {
  /** Organization-wide theme (org endpoint and candidate payload only; absent on the platform endpoint). */
  page_theme?: string | null
  nav_theme?: string | null
  background_color?: string | null
  /** Custom navigation / text colors ('#RRGGBB' or null). They win over the presets above. */
  side_nav_color?: string | null
  side_nav_text_color?: string | null
  top_nav_color?: string | null
  top_nav_text_color?: string | null
  page_text_color?: string | null
  primary_color: string | null
  accent_color: string | null
  background_style: string | null
  font_key: string | null
  logo_url: string | null
  favicon_url: string | null
  is_customized: boolean
  contrast?: {
    primary?: { text_color: string }
    accent?: { text_color: string }
  }
}

/** Page backgrounds the server knows by key (BrandingIn.background_style). */
export const BACKGROUNDS: Record<string, string> = {
  mint: '#f5fbfa',
  plain_white: '#ffffff',
  soft_gray: '#f4f5f7',
  navy_band: '#e9eef5',
}

/** Curated self-hosted list (spec 8.6), keys match the server's font_key enum. Each font loads on demand. */
export const FONTS: Record<string, { family: string; load: () => Promise<unknown> }> = {
  inter: { family: "'Inter Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/inter') },
  source_sans_3: { family: "'Source Sans 3 Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/source-sans-3') },
  nunito_sans: { family: "'Nunito Sans Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/nunito-sans') },
  ibm_plex_sans: { family: "'IBM Plex Sans Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/ibm-plex-sans') },
  lato: { family: "'Lato', system-ui, sans-serif", load: () => Promise.all([import('@fontsource/lato/400.css'), import('@fontsource/lato/700.css')]) },
  merriweather: { family: "'Merriweather Variable', Georgia, serif", load: () => import('@fontsource-variable/merriweather') },
}

/** CSS font-family for a key (falls back to Inter) and makes sure its font files are loaded. */
export function fontFamily(key: string | null | undefined): string | null {
  const f = key ? FONTS[key] : undefined
  if (!f) return null
  void f.load().catch(() => undefined)
  return f.family
}

/** One colour combination: every value the Branding page fills in, fully resolved. All pairs pass WCAG AA (4.5). */
export interface ColorCombo {
  key: string
  primary: string
  accent: string
  bg: string
  text: string
  surface: string
  border: string
  muted: string
  sideBg: string
  sideText: string
  topBg: string
  topText: string
}
/** The only presets offered in the picker. Surface, border and muted are mixes of bg and text (never a new hue). */
export const COLOR_COMBOS: ColorCombo[] = [
  { key: 'burgundy_gold', primary: '#5B0E14', accent: '#BD9767', bg: '#F1E194', text: '#5B0E14', surface: '#F9F3D4', border: '#DBC181', muted: '#79382E', sideBg: '#5B0E14', sideText: '#F1E194', topBg: '#5B0E14', topText: '#F1E194' },
  { key: 'sage_forest', primary: '#ACCBA2', accent: '#C9DDC3', bg: '#1A2517', text: '#ACCBA2', surface: '#2A3427', border: '#344330', muted: '#8FAA86', sideBg: '#11180F', sideText: '#ACCBA2', topBg: '#11180F', topText: '#ACCBA2' },
  { key: 'cream_violet', primary: '#5F4A8B', accent: '#9789B4', bg: '#FEFACD', text: '#261E38', surface: '#FFFDEB', border: '#DED9B7', muted: '#514A56', sideBg: '#5F4A8B', sideText: '#FEFACD', topBg: '#5F4A8B', topText: '#FEFACD' },
  { key: 'teal_linen', primary: '#004741', accent: '#80A3A0', bg: '#F0EDE4', text: '#002724', surface: '#F9F8F4', border: '#CCCFC7', muted: '#304F4A', sideBg: '#004741', sideText: '#F0EDE4', topBg: '#004741', topText: '#F0EDE4' },
  { key: 'lime_moss', primary: '#E4FD97', accent: '#ADC477', bg: '#2D3E2C', text: '#E4FD97', surface: '#3C4C3B', border: '#4E603F', muted: '#BFD782', sideBg: '#1D281D', sideText: '#E4FD97', topBg: '#1D281D', topText: '#E4FD97' },
  { key: 'amber_ink', primary: '#FFBE0B', accent: '#FFD560', bg: '#2A2312', text: '#FFBE0B', surface: '#393223', border: '#503F11', muted: '#D49F0C', sideBg: '#1B170C', sideText: '#FFBE0B', topBg: '#1B170C', topText: '#FFBE0B' },
  { key: 'ember_night', primary: '#FF4103', accent: '#FF7A4F', bg: '#001621', text: '#E6E8E9', surface: '#122631', border: '#293C45', muted: '#B8BEC1', sideBg: '#000E15', sideText: '#E6E8E9', topBg: '#000E15', topText: '#E6E8E9' },
  { key: 'violet_sun', primary: '#7357D8', accent: '#FFD84D', bg: '#F8F7F2', text: '#231A41', surface: '#FCFCFA', border: '#D8D6D7', muted: '#4E4664', sideBg: '#7357D8', sideText: '#F8F7F2', topBg: '#7357D8', topText: '#F8F7F2' },
  { key: 'forest_blush', primary: '#315C4C', accent: '#F2A7B5', bg: '#FFF7E8', text: '#14251E', surface: '#FFFCF6', border: '#DCD8CA', muted: '#434F46', sideBg: '#315C4C', sideText: '#FFF7E8', topBg: '#315C4C', topText: '#FFF7E8' },
  { key: 'cobalt_citrus', primary: '#185ADB', accent: '#FF8A3D', bg: '#F5F1E8', text: '#071B42', surface: '#FBF9F6', border: '#D1D1CF', muted: '#374663', sideBg: '#185ADB', sideText: '#F5F1E8', topBg: '#185ADB', topText: '#F5F1E8' },
  { key: 'plum_mint', primary: '#593C8F', accent: '#A8D5BA', bg: '#FAF6EE', text: '#1F1532', surface: '#FDFBF8', border: '#D9D4D2', muted: '#4B4258', sideBg: '#593C8F', sideText: '#FAF6EE', topBg: '#593C8F', topText: '#FAF6EE' },
]

/** The combination whose values all match the given ones (case-insensitive), or undefined for a custom mix. */
export function matchCombo(v: { primary: string; accent: string; bg: string; text: string; sideBg: string; sideText: string; topBg: string; topText: string }): ColorCombo | undefined {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  return COLOR_COMBOS.find((c) => same(c.primary, v.primary) && same(c.accent, v.accent) && same(c.bg, v.bg) && same(c.text, v.text) && same(c.sideBg, v.sideBg) && same(c.sideText, v.sideText) && same(c.topBg, v.topBg) && same(c.topText, v.topText))
}

/** Mix two #RRGGBB colours: t = 0 gives a, t = 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (x: string, i: number) => parseInt(x.slice(i, i + 2), 16)
  return `#${[1, 3, 5].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/**
 * Card surface, border and muted text derived from a custom page background and text colour, so cards, inputs,
 * tables and modals follow the page (light: whiter surface; dark: lighter surface).
 */
export function surfaceTokens(bg: string, text: string): Record<string, string> {
  const dark = contrastRatio(bg, '#000000') < contrastRatio(bg, '#FFFFFF')
  return {
    '--color-text': text,
    '--color-surface': dark ? mixHex(bg, '#FFFFFF', 0.07) : mixHex(bg, '#FFFFFF', 0.6),
    '--color-border': mixHex(bg, text, dark ? 0.18 : 0.15),
    '--color-text-muted': mixHex(bg, text, 0.8),
  }
}

/** Main page (body) themes of the previous release: only used to render keys already saved on a server. */
export interface PageTheme {
  key: string
  bg: string
  surface: string
  text: string
  muted: string
  border: string
}
/** LEGACY: 5 light + 5 dark page themes. Not offered in the picker. */
export const LEGACY_PAGE_THEMES: PageTheme[] = [
  { key: 'oat', bg: '#f7f1ea', surface: '#fffbf6', text: '#2b2118', muted: '#6a5848', border: '#e4d8c9' },
  { key: 'sage', bg: '#eef3ec', surface: '#fafcf9', text: '#1d2b22', muted: '#52655a', border: '#d3dfd1' },
  { key: 'lilac', bg: '#f3f0fb', surface: '#fdfcff', text: '#241a40', muted: '#5e5580', border: '#dcd5f0' },
  { key: 'glass', bg: '#eaf3fa', surface: '#fbfdff', text: '#0f2540', muted: '#49627c', border: '#cbdcec' },
  { key: 'blush', bg: '#fbf0ec', surface: '#fffaf8', text: '#3a1f19', muted: '#7a5148', border: '#f0d9d1' },
  { key: 'ink', bg: '#0b1020', surface: '#141b2e', text: '#eaf0ff', muted: '#b4c0dc', border: '#263250' },
  { key: 'graphite', bg: '#111214', surface: '#1a1c1f', text: '#f3f4f6', muted: '#bcc0c7', border: '#2b2e33' },
  { key: 'pine', bg: '#0a1f1a', surface: '#112b24', text: '#e6f7f0', muted: '#a5cbbd', border: '#1e4237' },
  { key: 'aubergine', bg: '#1a1024', surface: '#251735', text: '#f4ecfb', muted: '#c8b6dc', border: '#3b2752' },
  { key: 'ember', bg: '#1c1210', surface: '#281a17', text: '#fbefe9', muted: '#d1b5aa', border: '#43302a' },
]
/** The built-in starter look, used until a theme is picked. */
const STARTER_PAGE: PageTheme = { key: '', bg: '#f5fbfa', surface: '#ffffff', text: '#0c2340', muted: '#4b5d73', border: '#d5e3e0' }
export const pageThemeOf = (key: string | undefined) => LEGACY_PAGE_THEMES.find((t) => t.key === key) ?? STARTER_PAGE
export function pageTokens(key: string | undefined): Record<string, string> {
  const p = pageThemeOf(key)
  return { '--color-bg': p.bg, '--color-surface': p.surface, '--color-text': p.text, '--color-text-muted': p.muted, '--color-border': p.border }
}

/** Side and top navigation themes. Text colors are chosen per theme so they stay readable. */
export interface NavTheme {
  key: string
  bg: string
  text: string
  muted: string
  border: string
  hover: string
}
const nav = (key: string, bg: string, text: string, dark: boolean): NavTheme => ({
  key,
  bg,
  text,
  muted: dark ? 'rgb(255 255 255 / 0.78)' : 'rgb(15 23 42 / 0.62)',
  border: dark ? 'rgb(255 255 255 / 0.14)' : 'rgb(15 23 42 / 0.12)',
  hover: dark ? 'rgb(255 255 255 / 0.10)' : 'rgb(15 23 42 / 0.06)',
})
/** LEGACY: 5 light + 5 dark navigation themes. Only used to render a saved nav_theme key. */
const LEGACY_NAV_THEMES: NavTheme[] = [
  nav('oat', '#efe4d5', '#2b2118', false),
  nav('sage', '#e0eadd', '#1d2b22', false),
  nav('lilac', '#e8e2f7', '#241a40', false),
  nav('glass', '#dbe8f4', '#0f2540', false),
  nav('blush', '#f6e1d9', '#3a1f19', false),
  nav('ink', '#070b17', '#eaf0ff', true),
  nav('graphite', '#0b0c0e', '#f3f4f6', true),
  nav('pine', '#07160f', '#e6f7f0', true),
  nav('aubergine', '#120a1b', '#f4ecfb', true),
  nav('ember', '#130c0a', '#fbefe9', true),
]
/** Nothing picked yet: the bars follow the page tokens (vars resolve where they are applied). */
const NAV_MATCH_PAGE: NavTheme = { key: '', bg: 'var(--color-surface)', text: 'var(--color-text)', muted: 'var(--color-text-muted)', border: 'var(--color-border)', hover: 'var(--color-bg)' }

/**
 * One-time migration only: theme settings used to live in this browser (key per organization).
 * They are organization-wide on the server now; the Branding settings page offers the legacy values once.
 */
interface LegacyBranding {
  background_color?: string
  page_theme?: string
  nav_theme?: string
}
const legacyKey = (org: string) => `hr.branding.local.${org}`
export function readLegacyBranding(org: string | null | undefined): LegacyBranding | null {
  if (!org) return null
  try {
    const v = JSON.parse(localStorage.getItem(legacyKey(org)) ?? 'null') as LegacyBranding | null
    return v && (v.background_color || v.page_theme || v.nav_theme) ? v : null
  } catch {
    return null
  }
}
export function clearLegacyBranding(org: string | null | undefined) {
  if (!org) return
  try {
    localStorage.removeItem(legacyKey(org))
  } catch {
    // storage blocked: nothing to clean
  }
}

/** Accepts #RGB / #RRGGBB (the # is optional) and returns uppercase #RRGGBB, or null when it is not a color code. */
export function normalizeHex(v: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim())
  if (!m) return null
  const h = m[1]!.toUpperCase()
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`
}
/** True for a complete #RRGGBB code. */
export const isHex = (v: string | null | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v)

/** Black or white, whichever reads better on `bg` (a #RRGGBB color). */
export function readableText(bg: string): '#000000' | '#FFFFFF' {
  return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#FFFFFF') ? '#000000' : '#FFFFFF'
}

/** Default page text on a custom background: the starter navy when it is readable, else black or white. */
const readableTextOn = (bg: string) => (contrastRatio(bg, '#0C2340') >= 4.5 ? '#0C2340' : readableText(bg))

const channels = (hex: string) => `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`
const alpha = (hex: string, a: number) => `rgb(${channels(hex)} / ${a})`

/** What the user chose for one bar (all optional). Precedence: custom colors, then the preset, then match the page. */
export interface BarInput {
  preset?: string | null
  color?: string | null
  text?: string | null
}

/**
 * CSS variables for the side or the top bar: --{prefix}-bg / -text / -muted / -border / -hover.
 * With nothing chosen nothing is emitted (index.css makes the bar follow the page) unless `matchPage`
 * is set (the preview needs the page values on its own element).
 */
export function barTokens(prefix: 'side' | 'top', i: BarInput, matchPage = false): Record<string, string | null> {
  const theme = LEGACY_NAV_THEMES.find((t) => t.key === i.preset)
  const color = isHex(i.color) ? i.color : null
  const customText = isHex(i.text) ? i.text : null
  const put = (n: NavTheme) => ({ [`--${prefix}-bg`]: n.bg, [`--${prefix}-text`]: n.text, [`--${prefix}-muted`]: n.muted, [`--${prefix}-border`]: n.border, [`--${prefix}-hover`]: n.hover })
  if (!color && !customText) return theme ? put(theme) : matchPage ? put(NAV_MATCH_PAGE) : {}
  const bg = color ?? theme?.bg ?? (matchPage ? NAV_MATCH_PAGE.bg : null)
  const text = customText ?? (color ? readableText(color) : (theme?.text ?? null))
  if (!text) return {}
  return {
    [`--${prefix}-bg`]: bg,
    [`--${prefix}-text`]: text,
    [`--${prefix}-muted`]: alpha(text, 0.72),
    [`--${prefix}-border`]: alpha(text, 0.16),
    [`--${prefix}-hover`]: alpha(text, 0.1),
  }
}

/** Page text color override (muted text is the same color, softer). */
export function pageTextTokens(text: string | null | undefined): Record<string, string> {
  return isHex(text) ? { '--color-text': text, '--color-text-muted': alpha(text, 0.72) } : {}
}

/** Turn a branding response into CSS variables. The server already vetted contrast. */
export function brandingToTokens(b: BrandingOut): Record<string, string | null> {
  const page: Record<string, string> = b.page_theme ? pageTokens(b.page_theme) : {}
  return {
    '--color-primary': b.primary_color,
    '--color-primary-contrast': b.contrast?.primary?.text_color ?? null,
    '--color-accent': b.accent_color,
    '--color-accent-contrast': b.contrast?.accent?.text_color ?? null,
    '--font-sans': fontFamily(b.font_key),
    ...page,
    '--color-bg': b.background_color ?? page['--color-bg'] ?? (b.background_style ? (BACKGROUNDS[b.background_style] ?? null) : null),
    // A custom background without a legacy page theme: cards, borders and muted text follow it.
    ...(isHex(b.background_color) && !b.page_theme
      ? surfaceTokens(b.background_color, isHex(b.page_text_color) ? b.page_text_color : readableTextOn(b.background_color))
      : pageTextTokens(b.page_text_color)),
    ...barTokens('side', { preset: b.nav_theme, color: b.side_nav_color, text: b.side_nav_text_color }),
    ...barTokens('top', { preset: b.nav_theme, color: b.top_nav_color, text: b.top_nav_text_color }),
  }
}

/** Applies colours, font, themes and the favicon; a missing favicon restores the default one. */
export function applyBranding(b: BrandingOut) {
  applyTheme(brandingToTokens(b))
  setFavicon(b.favicon_url ?? null)
}

/** WCAG contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
