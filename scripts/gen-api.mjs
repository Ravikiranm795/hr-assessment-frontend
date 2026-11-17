// Prepares api/openapi.patched.json from api/openapi.json.
// Any $ref that points to a schema missing from components.schemas is replaced by a permissive
// stub, so the type generator does not crash. Stubbed names are printed and must be listed in
// docs/progress/API_GAPS.md ("needs backend change").
// Usage: node scripts/gen-api.mjs   (then the npm script runs openapi-typescript)
import { readFileSync, writeFileSync } from 'node:fs'

const src = JSON.parse(readFileSync('api/openapi.json', 'utf8'))
const schemas = (src.components ??= {}).schemas ?? (src.components.schemas = {})
const missing = new Set()

const walk = (node) => {
  if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string' && node.$ref.startsWith('#/components/schemas/')) {
      const name = node.$ref.split('/').pop()
      if (!schemas[name]) missing.add(name)
    }
    for (const v of Object.values(node)) walk(v)
  }
}
walk(src)

for (const name of missing) {
  schemas[name] = { type: 'object', additionalProperties: true, description: 'STUB: schema missing in backend OpenAPI' }
}

writeFileSync('api/openapi.patched.json', JSON.stringify(src))
console.log(missing.size ? `Stubbed missing schemas: ${[...missing].join(', ')}` : 'No missing schemas')
