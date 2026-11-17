import type { components } from '@/api-types/schema'

type S = components['schemas']

export type AnswerRow = S['AnswerRow']
export type EventRow = S['EventRow']
export type DecisionRow = S['DecisionRow']

export interface HelpRow {
  id?: string
  reason?: string
  note?: string | null
  status?: string
  created_at?: string
  decided_at?: string | null
  decision_note?: string | null
  granted_extra_minutes?: number | null
  granted_camera_exempt?: boolean | null
}

/** `AttemptReport` with the loosely typed blocks narrowed to what the live API returns (read 2026-11-17). */
export type Attempt = Omit<S['AttemptReport'], 'candidate' | 'badges' | 'flag_counts' | 'help_requests'> & {
  candidate: { name: string; email: string | null; phone: string | null; erased: boolean }
  badges: {
    camera_exempt: boolean
    extra_time: boolean
    auto_submitted_by_timer: boolean
    accommodation_reason: string | null
  }
  flag_counts: { types: Record<string, number>; severity: Record<string, number> }
  help_requests: HelpRow[]
}

export type Decision = 'approved' | 'rejected' | 'waiting'
