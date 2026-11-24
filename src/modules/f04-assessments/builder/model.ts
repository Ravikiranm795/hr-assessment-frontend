import {
  defaultMarks,
  defaultScoring,
  type AssessmentDetail,
  type QuestionIn,
  type QuestionOut,
  type QuestionType,
  type ScoringMode,
  type SuggestedQuestion,
  type VersionOut,
  type VersionPatch,
} from '../api'
import { htmlToText } from '../ui/html'

export const CODE_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'csharp', 'sql', 'html', 'css', 'go', 'php']

let counter = 0
export const uid = () => `k${Date.now().toString(36)}${(counter++).toString(36)}`

export interface DraftOption {
  key: string
  text_html: string
  is_correct: boolean
}
export interface DraftSlot {
  key: string
  /** One accepted answer per line. */
  accepted: string
}

export interface DraftSample {
  key: string
  input: string
  expected: string
}

export const MAX_SAMPLES = 3
export const MIN_MINUTES = 5
export const MAX_MINUTES = 120

export interface DraftQuestion {
  /** Stable client key; the server id is only known after the first save. */
  key: string
  id: string | null
  rev: number
  savedRev: number
  type: QuestionType
  prompt_html: string
  marks: string
  scoring_mode: ScoringMode
  options: DraftOption[]
  slots: DraftSlot[]
  case_sensitive: boolean
  partial: boolean
  /** One key point per line. */
  key_points: string
  model_answer: string
  code_language: string
  /** code_write: minutes of the section (text, validated 5..120). */
  duration: string
  /** code_write: allowed language ids. */
  languages: string[]
  samples: DraftSample[]
  starter_code: string
  /** Last save error for this question (server text). */
  error: string | null
  fieldErrors: Record<string, string>
}

export interface Settings {
  title: string
  description: string
  duration: string
  passMark: string
  instructions_html: string
  company_name: string
  logo_asset_id: string | null
  footer_html: string
  shuffle_questions: boolean
  shuffle_options: boolean
}

export type SettingsErrors = Partial<Record<'title' | 'duration' | 'passMark', string>>

export const isDirtyQuestion = (q: DraftQuestion) => q.id === null || q.rev !== q.savedRev

const lines = (value: string) =>
  value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export function newQuestion(type: QuestionType): DraftQuestion {
  const choice = type === 'single_choice' || type === 'multi_choice'
  return {
    key: uid(),
    id: null,
    rev: 1,
    savedRev: 0,
    type,
    prompt_html: '',
    marks: String(defaultMarks(type)),
    scoring_mode: defaultScoring(type),
    options: choice ? [0, 1].map(() => ({ key: uid(), text_html: '', is_correct: false })) : [],
    slots: type === 'fill_blank' || type === 'code_gap' ? [{ key: uid(), accepted: '' }] : [],
    case_sensitive: type === 'code_gap',
    partial: false,
    key_points: '',
    model_answer: '',
    code_language: type === 'code_write' ? 'python' : '',
    duration: type === 'code_write' ? '30' : '',
    languages: type === 'code_write' ? ['python'] : [],
    samples: type === 'code_write' ? [{ key: uid(), input: '', expected: '' }] : [],
    starter_code: '',
    error: null,
    fieldErrors: {},
  }
}

type Key = Record<string, unknown>

/** Server question -> editable draft (answer key shapes: see backend `question_rules`). */
export function fromServer(q: QuestionOut): DraftQuestion {
  const key = (Array.isArray(q.answer_key) ? {} : (q.answer_key ?? {})) as Key
  const slots = (key[q.type === 'fill_blank' ? 'blanks' : 'gaps'] as { accepted?: string[] }[] | undefined) ?? []
  return {
    key: uid(),
    id: q.id,
    rev: 1,
    savedRev: 1,
    type: q.type,
    prompt_html: q.prompt_html,
    marks: String(q.marks),
    scoring_mode: q.scoring_mode,
    options: q.options.map((o) => ({ key: uid(), text_html: o.text_html, is_correct: o.is_correct })),
    slots: slots.map((s) => ({ key: uid(), accepted: (s.accepted ?? []).join('\n') })),
    case_sensitive: typeof key.case_sensitive === 'boolean' ? key.case_sensitive : q.type === 'code_gap',
    partial: key.partial === true,
    key_points: ((key.key_points as string[] | undefined) ?? []).join('\n'),
    model_answer: q.model_answer ?? '',
    code_language: q.code_language ?? '',
    duration: q.duration_minutes != null ? String(q.duration_minutes) : '',
    languages: Array.isArray(key.languages) ? (key.languages as string[]) : [],
    samples: (Array.isArray(key.samples) ? (key.samples as { input?: string; expected?: string }[]) : []).map((s) => ({
      key: uid(),
      input: s.input ?? '',
      expected: s.expected ?? '',
    })),
    starter_code: typeof key.starter_code === 'string' ? key.starter_code : '',
    error: null,
    fieldErrors: {},
  }
}

/** AI suggestion -> draft question (it is saved by the normal flow or via the bulk endpoint). */
export function suggestionToIn(s: SuggestedQuestion): QuestionIn {
  const body: QuestionIn = {
    type: s.type,
    prompt_html: s.prompt_html,
    marks: s.marks,
    scoring_mode: s.scoring_mode,
  }
  if (s.options && s.options.length > 0) body.options = s.options.map((o) => ({ text_html: o.text_html, is_correct: o.is_correct }))
  if (s.answer_key) body.answer_key = s.answer_key
  if (s.model_answer) body.model_answer = s.model_answer
  if (s.code_language) body.code_language = s.code_language
  return body
}

/** Draft -> request body. Empty options and empty accepted answers are dropped (the server rejects them). */
export function toPayload(d: DraftQuestion): QuestionIn {
  const body: QuestionIn = {
    type: d.type,
    prompt_html: d.prompt_html,
    marks: d.type === 'code_write' ? 0 : Number(d.marks),
    scoring_mode: d.scoring_mode,
  }
  if (d.type === 'code_write') {
    const languages = d.languages
    body.duration_minutes = Number(d.duration)
    body.answer_key = {
      languages,
      samples: d.samples.filter(validSample).map((s) => ({ input: s.input, expected: s.expected })),
      starter_code: d.starter_code.trim() === '' ? null : d.starter_code,
      key_points: lines(d.key_points),
    }
    body.code_language = languages.includes(d.code_language) ? d.code_language : (languages[0] ?? null)
    body.model_answer = d.model_answer.trim() || null
    return body
  }
  if (d.type === 'single_choice' || d.type === 'multi_choice') {
    body.options = d.options.filter((o) => htmlToText(o.text_html) !== '').map((o) => ({ text_html: o.text_html, is_correct: o.is_correct }))
  }
  if (d.type === 'multi_choice') body.answer_key = { partial: d.partial }
  if (d.type === 'fill_blank') {
    body.answer_key = { blanks: d.slots.map((s) => ({ accepted: lines(s.accepted) })), case_sensitive: d.case_sensitive }
  }
  if (d.type === 'code_gap') {
    body.answer_key = {
      gaps: d.slots.map((s) => ({ accepted: lines(s.accepted) })),
      case_sensitive: d.case_sensitive,
      key_points: lines(d.key_points),
    }
    body.code_language = d.code_language || null
  }
  if (d.type === 'short_answer') body.answer_key = { key_points: lines(d.key_points) }
  if (d.type === 'code_gap' || d.type === 'short_answer') body.model_answer = d.model_answer.trim() || null
  return body
}

/**
 * Problems found locally, mirroring the backend: the first three block a save (`question_rules.normalize_question`),
 * the rest block a publish (`question_rules.question_issues`).
 */
export type IssueCode =
  | 'prompt_empty'
  | 'marks_invalid'
  | 'model_answer_required'
  | 'too_few_options'
  | 'no_correct_option'
  | 'multiple_correct_options'
  | 'no_blanks'
  | 'blank_without_answers'
  | 'no_samples'
  | 'no_languages'
  | 'duration_missing'

export const SAVE_BLOCKING: IssueCode[] = ['prompt_empty', 'marks_invalid', 'model_answer_required', 'no_samples', 'no_languages', 'duration_missing']

/** A sample needs an expected output (the input may be empty). */
export const validSample = (s: DraftSample) => s.expected.trim() !== ''

export function questionIssues(d: DraftQuestion): IssueCode[] {
  const issues: IssueCode[] = []
  if (htmlToText(d.prompt_html) === '') issues.push('prompt_empty')
  if (d.type === 'code_write') {
    const minutes = Number(d.duration)
    if (d.duration.trim() === '' || !Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) issues.push('duration_missing')
    if (d.languages.length === 0) issues.push('no_languages')
    if (!d.samples.some(validSample)) issues.push('no_samples')
    return issues
  }
  const marks = Number(d.marks)
  if (d.marks.trim() === '' || !Number.isFinite(marks) || marks <= 0) issues.push('marks_invalid')
  if (d.type === 'single_choice' || d.type === 'multi_choice') {
    const filled = d.options.filter((o) => htmlToText(o.text_html) !== '')
    const correct = filled.filter((o) => o.is_correct).length
    if (filled.length < 2) issues.push('too_few_options')
    if (correct === 0) issues.push('no_correct_option')
    else if (d.type === 'single_choice' && correct > 1) issues.push('multiple_correct_options')
  } else if (d.type === 'fill_blank' || (d.type === 'code_gap' && d.scoring_mode === 'auto')) {
    if (d.slots.length === 0) issues.push('no_blanks')
    else if (d.slots.some((s) => lines(s.accepted).length === 0)) issues.push('blank_without_answers')
  }
  if (d.scoring_mode === 'ai' && d.model_answer.trim() === '' && lines(d.key_points).length === 0) {
    issues.push('model_answer_required')
  }
  return issues
}

export function settingsFrom(assessment: AssessmentDetail, version: VersionOut): Settings {
  const header = version.header_config as { company_name?: string | null; logo_asset_id?: string | null }
  return {
    title: assessment.title,
    description: assessment.description ?? '',
    duration: String(version.duration_minutes),
    passMark: String(version.pass_mark_percent),
    instructions_html: version.instructions_html ?? '',
    company_name: header.company_name ?? '',
    logo_asset_id: header.logo_asset_id ?? null,
    footer_html: version.footer_html ?? '',
    shuffle_questions: version.shuffle_questions,
    shuffle_options: version.shuffle_options,
  }
}

export function validateSettings(s: Settings): SettingsErrors {
  const errors: SettingsErrors = {}
  const duration = Number(s.duration)
  const pass = Number(s.passMark)
  if (s.title.trim() === '') errors.title = 'required'
  if (s.duration.trim() === '' || !Number.isInteger(duration) || duration < 5 || duration > 480) errors.duration = 'range'
  if (s.passMark.trim() === '' || !Number.isFinite(pass) || pass < 0 || pass > 100) errors.passMark = 'range'
  return errors
}

/** The version-level fields that differ from the saved copy (and are valid), as a PATCH body. */
export function versionPatch(s: Settings, saved: Settings, errors: SettingsErrors): VersionPatch {
  const patch: VersionPatch = {}
  if (s.duration !== saved.duration && !errors.duration) patch.duration_minutes = Number(s.duration)
  if (s.passMark !== saved.passMark && !errors.passMark) patch.pass_mark_percent = Number(s.passMark)
  if (s.instructions_html !== saved.instructions_html) patch.instructions_html = s.instructions_html
  if (s.company_name !== saved.company_name) {
    patch.header_config = { company_name: s.company_name.trim() || null, logo_asset_id: s.logo_asset_id }
  }
  if (s.footer_html !== saved.footer_html) patch.footer_html = s.footer_html
  if (s.shuffle_questions !== saved.shuffle_questions) patch.shuffle_questions = s.shuffle_questions
  if (s.shuffle_options !== saved.shuffle_options) patch.shuffle_options = s.shuffle_options
  return patch
}
