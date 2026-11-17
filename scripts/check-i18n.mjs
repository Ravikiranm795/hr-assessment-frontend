// Fails the lint step on hard-coded user-visible English in UI code (spec 8.7).
// Heuristic: JSX text nodes and the attributes placeholder/title/aria-label/alt with plain words.
// Allowed: text inside {t('...')}, numbers, symbols, and lines ending with "// i18n-ok".
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = 'src'
const SKIP = ['api-types', 'locales']
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (!SKIP.includes(name)) walk(p)
    } else if (extname(p) === '.tsx') files.push(p)
  }
}
walk(ROOT)

const attr = /\b(placeholder|title|aria-label|alt|label)="([^"{}]*[A-Za-z]{2,}[^"{}]*)"/
const text = />\s*([A-Za-z][^<>{}]*[A-Za-z.!?:])\s*<\//
const problems = []
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('i18n-ok')) return
    const m = line.match(attr) || line.match(text)
    if (m) problems.push(`${f}:${i + 1}: ${m[0].trim().slice(0, 80)}`)
  })
}
if (problems.length) {
  console.error(`Hard-coded UI text found (${problems.length}). Use t('key') from en.json:\n` + problems.join('\n'))
  process.exit(1)
}
console.log(`i18n check passed (${files.length} files)`)
