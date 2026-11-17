import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en.json'

type Dict = Record<string, unknown>

function merge(target: Dict, source: Dict): Dict {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key]
    if (value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object') {
      merge(existing as Dict, value as Dict)
    } else {
      target[key] = value
    }
  }
  return target
}

// Each module owns `src/modules/<module>/locales/en.json` (keys under its own top-level namespace),
// merged here at build time so parallel work never collides on the shared file (spec 8.7 key pattern).
const moduleFiles = import.meta.glob<Dict>('/src/modules/*/locales/en.json', { eager: true, import: 'default' })
const translation = Object.values(moduleFiles).reduce<Dict>((all, file) => merge(all, file), structuredClone(en) as Dict)

// English is the only shipped language; a missing key falls back to English (spec 8.7).
void i18n.use(initReactI18next).init({
  resources: { en: { translation } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
export const t = i18n.t.bind(i18n)
