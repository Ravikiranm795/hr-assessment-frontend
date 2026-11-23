const KEY = 'exam.proctor.sessionId'
let memoryId: string | null = null

/** One random id per browser tab; kept in sessionStorage so a reload keeps it. Storage may be blocked. */
export function getProctorSessionId(): string {
  try {
    const stored = sessionStorage.getItem(KEY)
    if (stored) return stored
  } catch {
    // storage blocked: fall back to memory
  }
  memoryId ??= crypto.randomUUID()
  try {
    sessionStorage.setItem(KEY, memoryId)
  } catch {
    // ignore
  }
  return memoryId
}

/** Consecutive failed heartbeats before the candidate is told the proctoring connection is lost. */
export const HEARTBEAT_FAIL_LIMIT = 3
