/**
 * Client-side WCAG contrast pre-check for the platform theme.
 * The platform endpoint has no `/validate` (logged in API_GAPS) and its PUT does not reject low contrast,
 * so this mirrors the organization rule the server applies: text is white or #111827, whichever reads better,
 * and the ratio must be at least 4.5.
 */
export const MIN_CONTRAST = 4.5
const LIGHT = '#FFFFFF'
const DARK = '#111827'

export const HEX = /^#[0-9a-fA-F]{6}$/

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export interface ContrastCheck {
  textColor: string
  ratio: number
  passes: boolean
}

export function checkContrast(color: string): ContrastCheck {
  const light = ratio(color, LIGHT)
  const dark = ratio(color, DARK)
  const best = light >= dark ? { textColor: LIGHT, value: light } : { textColor: DARK, value: dark }
  const rounded = Math.floor(best.value * 100) / 100
  return { textColor: best.textColor, ratio: rounded, passes: best.value >= MIN_CONTRAST }
}
