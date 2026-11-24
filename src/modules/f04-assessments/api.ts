import type { components } from '@/api-types/schema'
import { api } from '@/core/api/client'

type S = components['schemas']

export type AssessmentListItem = S['AssessmentListItem']
export type AssessmentDetail = S['AssessmentDetail']
export type VersionSummary = S['VersionSummary']
export type VersionOut = S['app__modules__m05_assessments__schemas__VersionOut']
export type QuestionOut = S['QuestionOut']
export type QuestionIn = S['QuestionIn']
export type PreviewOut = S['PreviewOut']
export type SuggestedQuestion = S['SuggestedQuestion']
export type QuestionGenRequest = S['QuestionGenRequest']
export type QuestionGenResponse = S['QuestionGenResponse']
export type AiOptions = S['AiOptionsResponse']
export type VersionPatch = S['VersionPatch']
export type QuestionType = QuestionOut['type']
export type ScoringMode = QuestionOut['scoring_mode']

export const QUESTION_TYPES: QuestionType[] = ['single_choice', 'multi_choice', 'fill_blank', 'code_gap', 'short_answer']

/** Scoring modes the backend accepts per type (`question_rules.ALLOWED_SCORING`). */
export const ALLOWED_SCORING: Record<QuestionType, ScoringMode[]> = {
  single_choice: ['auto'],
  multi_choice: ['auto'],
  fill_blank: ['auto'],
  code_gap: ['auto', 'ai', 'manual'],
  short_answer: ['ai', 'manual'],
  code_write: ['ai', 'manual'],
}
export const DEFAULT_SCORING: Record<QuestionType, ScoringMode> = {
  single_choice: 'auto',
  multi_choice: 'auto',
  fill_blank: 'auto',
  code_gap: 'auto',
  short_answer: 'manual',
  code_write: 'ai',
}
export const DEFAULT_MARKS: Record<QuestionType, number> = {
  single_choice: 1,
  multi_choice: 1,
  fill_blank: 2,
  code_gap: 2,
  short_answer: 5,
  code_write: 0,
}

/** Safe lookups: an unknown type (newer backend) must never crash the builder. */
export const allowedScoring = (type: string): ScoringMode[] => ALLOWED_SCORING[type as QuestionType] ?? ['manual']
export const defaultScoring = (type: string): ScoringMode => DEFAULT_SCORING[type as QuestionType] ?? 'manual'
export const defaultMarks = (type: string): number => DEFAULT_MARKS[type as QuestionType] ?? 1

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ListParams {
  page: number
  pageSize: number
  sort?: string
  q?: string
  status?: 'active' | 'archived' | ''
  mine?: boolean
}

export const keys = {
  all: ['assessments'] as const,
  list: (p: ListParams) => ['assessments', 'list', p] as const,
  detail: (id: string) => ['assessments', 'detail', id] as const,
  version: (id: string, vid: string) => ['assessments', 'version', id, vid] as const,
  preview: (id: string, vid: string) => ['assessments', 'preview', id, vid] as const,
  aiOptions: ['assessments', 'ai-options'] as const,
}

const base = '/api/v1/assessments'

export const assessmentsApi = {
  list: (p: ListParams, signal?: AbortSignal) =>
    api.get<Page<AssessmentListItem>>(
      base,
      { page: p.page, page_size: p.pageSize, sort: p.sort, q: p.q, status: p.status, mine: p.mine || undefined },
      { signal },
    ),
  create: (body: { title: string; description?: string | null }) => api.post<AssessmentDetail>(base, body),
  detail: (id: string) => api.get<AssessmentDetail>(`${base}/${id}`),
  patch: (id: string, body: { title?: string; description?: string | null }) =>
    api.patch<AssessmentDetail>(`${base}/${id}`, body),
  duplicate: (id: string) => api.post<AssessmentDetail>(`${base}/${id}/duplicate`),
  archive: (id: string) => api.post<AssessmentDetail>(`${base}/${id}/archive`),
  unarchive: (id: string) => api.post<AssessmentDetail>(`${base}/${id}/unarchive`),
  remove: (id: string) => api.delete<void>(`${base}/${id}`),

  version: (id: string, vid: string) => api.get<VersionOut>(`${base}/${id}/versions/${vid}`),
  createVersion: (id: string) => api.post<VersionOut>(`${base}/${id}/versions`),
  patchVersion: (id: string, vid: string, body: VersionPatch) =>
    api.patch<VersionOut>(`${base}/${id}/versions/${vid}`, body),
  publish: (id: string, vid: string) => api.post<VersionOut>(`${base}/${id}/versions/${vid}/publish`),
  preview: (id: string, vid: string) => api.get<PreviewOut>(`${base}/${id}/versions/${vid}/preview`),

  addQuestion: (id: string, vid: string, body: QuestionIn) =>
    api.post<QuestionOut>(`${base}/${id}/versions/${vid}/questions`, body),
  patchQuestion: (id: string, vid: string, qid: string, body: Partial<QuestionIn>) =>
    api.patch<QuestionOut>(`${base}/${id}/versions/${vid}/questions/${qid}`, body),
  deleteQuestion: (id: string, vid: string, qid: string) =>
    api.delete<void>(`${base}/${id}/versions/${vid}/questions/${qid}`),
  reorder: (id: string, vid: string, questionIds: string[]) =>
    api.put<unknown>(`${base}/${id}/versions/${vid}/questions/reorder`, { question_ids: questionIds }),
  bulk: (id: string, vid: string, questions: QuestionIn[]) =>
    api.post<{ items: QuestionOut[] }>(`${base}/${id}/versions/${vid}/questions/bulk`, { questions }),

  aiOptions: () => api.get<AiOptions>(`${base}/ai/options`),
  aiGenerate: (body: QuestionGenRequest, signal?: AbortSignal) =>
    api.post<QuestionGenResponse>(`${base}/ai/generate`, body, { signal }),
}

/** Organization admins and engineers edit any assessment; HR owners edit their own, other HRs get a read-only view (spec F4). */
export function canEditAssessment(role: string | null, userId: string | undefined, ownerId: string): boolean {
  return role === 'org_admin' || role === 'engineer' || (role === 'hr_user' && userId === ownerId)
}

/** Latest version = highest number; a draft always is the latest. */
export function latestVersion(versions: VersionSummary[]): VersionSummary | undefined {
  return [...versions].sort((a, b) => b.version_no - a.version_no)[0]
}
