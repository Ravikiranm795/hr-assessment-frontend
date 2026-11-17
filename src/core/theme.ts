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

/** Back to the MRK starter theme defined in index.css. */
export function resetTheme() {
  const root = document.documentElement
  for (const name of applied) root.style.removeProperty(name)
  applied.clear()
}
