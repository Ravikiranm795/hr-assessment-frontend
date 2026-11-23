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
  /** Added by the backend next to `flag_counts`; absent on older payloads. */
  risk?: { score: number; level: 'low' | 'medium' | 'high'; flagged: boolean }
  /** Photo retention (added by the backend; absent on older payloads). */
  photos_delete_after?: string | null
  photos_purged_at?: string | null
  photo_count?: number
}

export interface PhotoItem {
  asset_id: string
  taken_at: string
  kind: 'periodic' | 'event' | 'baseline'
  event_id: string | null
  event_type: string | null
  severity: string | null
}

export interface PhotoPage {
  items: PhotoItem[]
  next_cursor: string | null
  total: number
}

export type Decision = 'approved' | 'rejected' | 'waiting'
