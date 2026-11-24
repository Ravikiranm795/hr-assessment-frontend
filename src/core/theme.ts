// The token layer reads theme values generically (spec 8.6), so extra variables can be added later
// without restructuring. Fixed tokens (success / warning / error) can never be overridden.
const LOCKED = new Set(['--color-success', '--color-warning', '--color-error'])
const applied = new Set<string>()

/** Apply organization or platform theme values as CSS variables, e.g. { '--color-primary': '#123456' }. */
export function applyTheme(tokens: Record<string, string | null | undefined>) {
  const root = document.documentElement
  for (const [name, value] of Object.entries(tokens)) {
    if (!name.startsWith('--') || LOCKED.has(name) || !value) continue
    root.style.setProperty(name, value)
    applied.add(name)
  }
}

let original: { href: string | null; type: string | null } | null = null

const ICON_TYPES: Record<string, string> = { png: 'image/png', ico: 'image/x-icon', svg: 'image/svg+xml', webp: 'image/webp' }

function iconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  return link
}

/** Show an organization favicon, or the default one from index.html when `url` is empty. Never touches the document title. */
export function setFavicon(url: string | null | undefined) {
  const link = iconLink()
  original ??= { href: link.getAttribute('href'), type: link.getAttribute('type') }
  if (!url) {
    if (original.href) link.setAttribute('href', original.href)
    else link.removeAttribute('href')
    if (original.type) link.setAttribute('type', original.type)
    else link.removeAttribute('type')
    return
  }
  const ext = /\.([a-z0-9]+)(?:$|[?#])/i.exec(url)?.[1]?.toLowerCase()
  const type = ext ? ICON_TYPES[ext] : undefined
  if (type) link.setAttribute('type', type)
  else link.removeAttribute('type')
  link.setAttribute('href', url)
}

/** Back to the MRK starter theme defined in index.css, with the default favicon. */
export function resetTheme() {
  const root = document.documentElement
  for (const name of applied) root.style.removeProperty(name)
  applied.clear()
  if (original) setFavicon(null)
}
