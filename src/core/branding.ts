import { applyTheme } from './theme'

/** Shape of GET /api/v1/org/branding and /api/v1/platform/branding (read live 2026-11-17). */
export interface BrandingOut {
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

/** Main page (body) themes: background, card surface, text, muted text and border move together. */
export interface PageTheme {
  key: string
  bg: string
  surface: string
  text: string
  muted: string
  border: string
}
/** 5 light + 5 dark, each with its own hue. Light: warm oat, sage, lilac, glass blue, clay blush. Dark: ink, graphite, pine, aubergine, ember. */
export const PAGE_THEMES: PageTheme[] = [
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
export const pageThemeOf = (key: string | undefined) => PAGE_THEMES.find((t) => t.key === key) ?? STARTER_PAGE
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
/** 5 light + 5 dark navigation themes, one per page-theme hue (a slightly deeper tone than the page). */
export const NAV_THEMES: NavTheme[] = [
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
/** Mixed themes: a page theme and a navigation theme of the opposite tone, picked together. */
export const MIXED_THEMES = [
  { key: 'harbor', page: 'glass', nav: 'ink' }, // light page, dark bars
  { key: 'meadow', page: 'sage', nav: 'pine' },
  { key: 'clay', page: 'blush', nav: 'ember' },
  { key: 'moonlit', page: 'graphite', nav: 'oat' }, // dark page, light bars
  { key: 'orchid', page: 'aubergine', nav: 'lilac' },
] as const

/** Nothing picked yet: the bars follow the page tokens (vars resolve where they are applied). */
const NAV_MATCH_PAGE: NavTheme = { key: '', bg: 'var(--color-surface)', text: 'var(--color-text)', muted: 'var(--color-text-muted)', border: 'var(--color-border)', hover: 'var(--color-bg)' }

/** Settings the server has no field for yet (API_GAPS.md); kept per browser and organization. */
export interface LocalBranding {
  background_color?: string
  page_theme?: string
  nav_theme?: string
}
const storeKey = (org: string) => `hr.branding.local.${org}`
export function loadLocalBranding(org: string | null | undefined): LocalBranding {
  try {
    return JSON.parse(localStorage.getItem(storeKey(org ?? 'x')) ?? '{}') as LocalBranding
  } catch {
    return {}
  }
}
export function saveLocalBranding(org: string | null | undefined, value: LocalBranding | null) {
  try {
    if (value) localStorage.setItem(storeKey(org ?? 'x'), JSON.stringify(value))
    else localStorage.removeItem(storeKey(org ?? 'x'))
  } catch {
    // storage blocked: the theme just won't persist locally
  }
}

export function navTokens(key: string | undefined): Record<string, string | null> {
  const n = NAV_THEMES.find((t) => t.key === key) ?? NAV_MATCH_PAGE
  return { '--nav-bg': n.bg, '--nav-text': n.text, '--nav-muted': n.muted, '--nav-border': n.border, '--nav-hover': n.hover }
}

/** Turn a branding response into CSS variables. The server already vetted contrast. */
export function brandingToTokens(b: BrandingOut, local?: LocalBranding): Record<string, string | null> {
  const page: Record<string, string> = local?.page_theme ? pageTokens(local.page_theme) : {}
  return {
    '--color-primary': b.primary_color,
    '--color-primary-contrast': b.contrast?.primary?.text_color ?? null,
    '--color-accent': b.accent_color,
    '--color-accent-contrast': b.contrast?.accent?.text_color ?? null,
    '--font-sans': fontFamily(b.font_key),
    ...page,
    '--color-bg': local?.background_color ?? page['--color-bg'] ?? (b.background_style ? (BACKGROUNDS[b.background_style] ?? null) : null),
    ...(local?.nav_theme ? navTokens(local.nav_theme) : {}),
  }
}

function setFavicon(url: string | null) {
  if (!url) return
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.removeAttribute('type')
  link.href = url
}

export function applyBranding(b: BrandingOut, local?: LocalBranding) {
  applyTheme(brandingToTokens(b, local))
  setFavicon(b.favicon_url)
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
