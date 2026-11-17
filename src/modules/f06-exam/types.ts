import type { components } from '@/api-types/schema'

type Schemas = components['schemas']

export type ExamState = Schemas['StateOut']
export type ExamQuestion = Schemas['PreviewQuestion']
export type QuestionType = ExamQuestion['type']
export type QuestionsOut = Schemas['QuestionsOut']
export type HelpRequest = Schemas['HelpOut']
export type HelpReason = Schemas['HelpIn']['reason']

/** The five answer shapes accepted by `PUT /exam/answers/{question_id}`. */
export type AnswerValue =
  | { option_id: string }
  | { option_ids: string[] }
  | { blanks: string[] }
  | { gaps: string[] }
  | { text: string }

/** Event type names accepted by the backend (`severity_rules.EVENT_TYPES`). Severity is server-assigned. */
export type ExamEventType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'no_face'
  | 'multiple_faces'
  | 'looking_away'
  | 'camera_lost'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'cut_attempt'
  | 'context_menu'
  | 'devtools_shortcut'
  | 'devtools_suspected'
  | 'page_reload'
  | 'offline'

export interface ExamEvent {
  type: ExamEventType
  occurred_at: string
  duration_ms?: number
  meta?: Record<string, unknown>
}

/** What the page needs from the organization branding that arrives with the state. */
export interface ExamHeader {
  companyName: string | null
  logoUrl: string | null
}

export interface Accommodations {
  cameraExempt: boolean
  timeMultiplier: number
  extraMinutes: number
}

export function readHeader(state: ExamState): ExamHeader {
  const raw = state.header ?? {}
  const company = typeof raw.company_name === 'string' ? raw.company_name : null
  const logo = state.branding?.logo_url
  return { companyName: company, logoUrl: typeof logo === 'string' && logo ? logo : null }
}

export function readAccommodations(state: ExamState): Accommodations {
  const raw = state.accommodations ?? {}
  return {
    cameraExempt: raw.camera_exempt === true,
    timeMultiplier: typeof raw.time_multiplier === 'number' ? raw.time_multiplier : 1,
    extraMinutes: typeof raw.extra_minutes === 'number' ? raw.extra_minutes : 0,
  }
}
