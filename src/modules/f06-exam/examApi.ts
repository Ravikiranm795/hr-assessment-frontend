import { api } from '@/core/api/client'
import type { components } from '@/api-types/schema'
import type { AnswerValue, ExamEvent, ExamState, HelpReason, HelpRequest, QuestionsOut } from './types'

type Schemas = components['schemas']

/** `events` (every accepted event) is newer than the generated types; absent on an older server. */
type EventsOutWithAll = Omit<Schemas['EventsOut'], 'serious'> & {
  serious?: { index: number; event_id: string }[] | null
  events?: { index: number; event_id: string; type?: string; severity?: string }[] | null
}

// The exam session token lives in memory only and is sent as the bearer token. It never touches the
// staff access token or the staff refresh flow (`skipRefresh`). The `exam_binding` cookie travels
// automatically because the shared client sends `credentials: "include"`.
let sessionToken: string | null = null
let inviteToken: string | null = null

export function clearSession() {
  sessionToken = null
  inviteToken = null
}

const auth = (extra: { keepalive?: boolean; signal?: AbortSignal } = {}) => ({
  token: sessionToken ?? '',
  skipRefresh: true,
  ...extra,
})

export const examApi = {
  async open(token: string) {
    // Opening is the one call without a session token yet; an empty string sends no Authorization header.
    const out = await api.post<Schemas['app__modules__m08_exam__schemas__SessionOut']>(
      '/api/v1/exam/session/open',
      { token },
      { token: '', skipRefresh: true },
    )
    sessionToken = out.session_token
    inviteToken = token
    return out
  },
  /** Same browser, same link: a new session token resumes the attempt (used when the token expires). */
  async reopen() {
    if (!inviteToken) throw new Error('NO_INVITE_TOKEN')
    return examApi.open(inviteToken)
  },
  state: (signal?: AbortSignal) => api.get<ExamState>('/api/v1/exam/session/state', undefined, auth({ signal })),
  systemCheck: (body: Schemas['SystemCheckIn']) =>
    api.post<Schemas['SystemCheckOut']>('/api/v1/exam/session/system-check', body, auth()),
  consent: (documentVersionId: string | null) =>
    api.post<Schemas['TimingOut']>(
      '/api/v1/exam/session/consent',
      { document_version_id: documentVersionId },
      auth(),
    ),
  baselinePhoto: (photo: Blob) => {
    const form = new FormData()
    form.append('file', photo, 'baseline.jpg')
    return api.upload<Schemas['TimingOut']>('/api/v1/exam/session/baseline-photo', form, auth())
  },
  start: () => api.post<Schemas['TimingOut']>('/api/v1/exam/session/start', undefined, auth()),
  /** `section` is required for a sectioned attempt (that section must be running) and ignored otherwise. */
  questions: (section?: string) =>
    api.get<QuestionsOut>('/api/v1/exam/questions', section ? { section } : undefined, auth()),
  sections: () => api.get<Schemas['SectionsOut']>('/api/v1/exam/sections', undefined, auth()),
  enterSection: (key: string) =>
    api.post<Schemas['SectionsOut']>(`/api/v1/exam/sections/${encodeURIComponent(key)}/enter`, undefined, auth()),
  submitSection: (key: string) =>
    api.post<Schemas['SectionSubmitOut']>(`/api/v1/exam/sections/${encodeURIComponent(key)}/submit`, undefined, auth()),
  codeOptions: () => api.get<{ enabled: boolean; languages: string[] }>('/api/v1/exam/code/options', undefined, auth()),
  /** Advisory only: the result is evidence for reviewers, never a score. */
  runCode: (body: Schemas['RunIn']) => api.post<Schemas['RunOut']>('/api/v1/exam/code/run', body, auth()),
  saveAnswer: (questionId: string, answer: AnswerValue) =>
    api.put<Schemas['AnswerOut']>(`/api/v1/exam/answers/${questionId}`, { answer }, auth()),
  /** Also the proctoring heartbeat: the tab's session id and whether the page is visible. */
  heartbeat: (body?: { session_id: string; visible: boolean }) =>
    api.post<Schemas['HeartbeatOut'] & { ok?: boolean; server_time?: string }>('/api/v1/exam/heartbeat', body, auth()),
  events: (events: ExamEvent[], keepalive = false) =>
    api.post<EventsOutWithAll>('/api/v1/exam/events', { events }, auth({ keepalive })),
  /** Without `eventId` it is a periodic capture; with it, the photo is the proof attached to that event. */
  snapshot: (image: Blob, eventId?: string) => {
    const form = new FormData()
    form.append('file', image, 'snapshot.jpg')
    if (eventId) form.append('event_id', eventId)
    return api.upload<Schemas['SnapshotOut']>('/api/v1/exam/snapshots', form, auth())
  },
  createHelp: (reason: HelpReason, note: string) =>
    api.post<HelpRequest>('/api/v1/exam/help-requests', { reason, note: note || null }, auth()),
  currentHelp: () => api.get<Schemas['HelpCurrentOut']>('/api/v1/exam/help-requests/current', undefined, auth()),
  submit: () => api.post<Schemas['SubmitOut']>('/api/v1/exam/submit', undefined, auth()),
}
