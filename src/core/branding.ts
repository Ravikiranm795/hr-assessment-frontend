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

const BACKGROUNDS: Record<string, string> = {
  mint: '#f5fbfa',
  soft_gray: '#f4f5f7',
  white: '#ffffff',
}

// Curated self-hosted list (spec 8.6). Only Inter is bundled so far; the others fall back to it
// until their @fontsource packages are added with the Branding settings screen.
const FONTS: Record<string, string> = {
  inter: "'Inter Variable', system-ui, sans-serif",
}

/** Turn a branding response into CSS variables. The server already vetted contrast. */
export function brandingToTokens(b: BrandingOut): Record<string, string | null> {
  return {
    '--color-primary': b.primary_color,
    '--color-primary-contrast': b.contrast?.primary?.text_color ?? null,
    '--color-accent': b.accent_color,
    '--color-accent-contrast': b.contrast?.accent?.text_color ?? null,
    '--color-bg': b.background_style ? (BACKGROUNDS[b.background_style] ?? null) : null,
    '--font-sans': b.font_key ? (FONTS[b.font_key] ?? null) : null,
  }
}

export function applyBranding(b: BrandingOut) {
  applyTheme(brandingToTokens(b))
}
