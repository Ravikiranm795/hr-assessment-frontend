import { ApiError } from '@/core/api/errors'
import { examApi } from '../examApi'
import { isTransient } from '../errors'
import type { ExamEvent, ExamEventType } from '../types'

const BATCH_MAX = 50
const QUEUE_MAX = 500
const FLUSH_EVERY_MS = 5000
/** A held key or a burst of clicks is one attempt, not twenty. */
const BURST_GAP_MS = 1000
const BURST_TYPES = new Set<ExamEventType>([
  'context_menu',
  'copy_attempt',
  'cut_attempt',
  'paste_attempt',
  'devtools_shortcut',
])

/**
 * Collects proctoring events and sends them in batches of at most 50: every few seconds, and
 * immediately (fetch with `keepalive`) when the page is hidden or closing. The server assigns severity
 * and ignores unknown types; the browser never decides what a violation means, and nothing here stops the exam.
 */
export class EventReporter {
  private queue: ExamEvent[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private sending = false
  private stopped = false
  private lastBurst = new Map<ExamEventType, number>()

  start() {
    this.stopped = false
    this.timer ??= setInterval(() => void this.flush(), FLUSH_EVERY_MS)
  }

  stop() {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  report(type: ExamEventType, extra: { durationMs?: number; meta?: Record<string, unknown> } = {}) {
    if (this.stopped) return
    if (BURST_TYPES.has(type)) {
      const now = performance.now()
      const last = this.lastBurst.get(type)
      if (last !== undefined && now - last < BURST_GAP_MS) return
      this.lastBurst.set(type, now)
    }
    const event: ExamEvent = { type, occurred_at: new Date().toISOString() }
    if (extra.durationMs !== undefined) event.duration_ms = Math.max(0, Math.round(extra.durationMs))
    if (extra.meta) event.meta = extra.meta
    this.queue.push(event)
    if (this.queue.length > QUEUE_MAX) this.queue.splice(0, this.queue.length - QUEUE_MAX)
    if (this.queue.length >= BATCH_MAX) void this.flush()
  }

  /** `keepalive` lets the request outlive the page; it cannot be awaited reliably, so it is fire-and-forget. */
  async flush(keepalive = false) {
    if (this.sending && !keepalive) return
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, BATCH_MAX)
      this.sending = true
      try {
        await examApi.events(batch, keepalive)
      } catch (error) {
        // The network or server failed: keep the batch for the next tick. Anything else (the exam is not
        // running, the session ended) cannot succeed later, so the batch is dropped.
        if (isTransient(error) && !this.stopped) {
          this.queue.unshift(...batch)
          if (this.queue.length > QUEUE_MAX) this.queue.length = QUEUE_MAX
        } else if (error instanceof ApiError && error.status === 409) {
          this.queue.length = 0
        }
        return
      } finally {
        this.sending = false
      }
      if (keepalive) return
    }
  }
}
