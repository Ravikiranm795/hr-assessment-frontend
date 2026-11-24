import { api } from '@/core/api/client'

export type AiSeverity = 'serious' | 'moderate' | 'minor' | 'info'

export interface AiSummaryContent {
  headline: string
  performance: { overview: string; strengths: string[]; weak_areas: string[] }
  answers: { question_id: string; position: number; note: string }[]
  integrity: {
    overview: string
    highlights: { type: string; severity: AiSeverity; count: number; note: string }[]
    caveat: string
  }
  disclaimer: string
}

export interface AiSummary {
  summary: AiSummaryContent | null
  generated_at: string | null
  model: string | null
  prompt_version: string | null
  stale: boolean
}

export const aiSummaryKey = (attemptId: string) => ['attempt-ai-summary', attemptId]

export function getAiSummary(attemptId: string) {
  return api.get<AiSummary>(`/api/v1/attempts/${attemptId}/ai-summary`)
}

export function generateAiSummary(attemptId: string, force: boolean) {
  return api.post<AiSummary>(`/api/v1/attempts/${attemptId}/ai-summary`, { force })
}
