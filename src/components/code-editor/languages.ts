import type { Extension } from '@codemirror/state'

/** Languages a candidate can write in. `id` is what the API stores as the question's `code_language`. */
export const CODE_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'java', label: 'Java' },
  { id: 'php', label: 'PHP' },
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C / C++' },
  { id: 'sql', label: 'SQL' },
] as const

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]['id']

export function isCodeLanguage(value: string | null | undefined): value is CodeLanguage {
  return CODE_LANGUAGES.some((l) => l.id === value)
}

// Each grammar is its own chunk: the editor downloads only the language the candidate picks.
const loaders: Record<CodeLanguage, () => Promise<Extension>> = {
  javascript: async () => (await import('@codemirror/lang-javascript')).javascript(),
  typescript: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true }),
  java: async () => (await import('@codemirror/lang-java')).java(),
  php: async () => (await import('@codemirror/lang-php')).php(),
  python: async () => (await import('@codemirror/lang-python')).python(),
  cpp: async () => (await import('@codemirror/lang-cpp')).cpp(),
  sql: async () => (await import('@codemirror/lang-sql')).sql(),
}

export function loadLanguage(id: CodeLanguage): Promise<Extension> {
  return loaders[id]()
}
