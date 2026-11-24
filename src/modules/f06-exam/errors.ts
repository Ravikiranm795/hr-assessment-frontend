import i18n from '@/core/i18n'
import { ApiError, NetworkError, errorText } from '@/core/api/errors'

/**
 * Candidate-facing text. The candidate gets a plain sentence per known code (module keys
 * `exam.errors.<CODE>`); everything else falls back to the shared `message_key` text.
 */
export function examErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `exam.errors.${error.code}`
    if (i18n.exists(key)) return i18n.t(key, { seconds: error.details.retry_after_sec })
  }
  return errorText(error)
}

/** Errors after which this link cannot continue in this browser; the page shows a full-screen message. */
const TERMINAL = new Set([
  'INVITE_EXPIRED',
  'INVITE_REVOKED',
  'LINK_BOUND_TO_OTHER_SESSION',
  'DEVICE_NOT_SUPPORTED',
  'NOT_FOUND',
  'ORG_DISABLED',
  'ROLE_NOT_OPEN',
  'ROLE_HAS_NO_ASSESSMENT',
])

export function isTerminal(error: unknown): boolean {
  return error instanceof ApiError && TERMINAL.has(error.code)
}

/** The section cannot take saves or questions any more (closed, expired, or not the running one). */
export function isSectionGone(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'SECTION_NOT_RUNNING' || error.code === 'SECTION_CLOSED' || error.code === 'SECTION_NOT_FOUND')
  )
}

export function isAlreadySubmitted(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'EXAM_ALREADY_SUBMITTED'
}

/** Worth retrying later: the network dropped, the server hiccuped or told us to slow down. */
export function isTransient(error: unknown): boolean {
  if (error instanceof NetworkError) return true
  return error instanceof ApiError && (error.status >= 500 || error.code === 'RATE_LIMITED')
}

/** The exam session token or binding is no longer valid; opening the link again resumes the exam. */
export function isSessionLost(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.code === 'UNAUTHENTICATED')
}
