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
  'app_switch_shortcut',
  'print_screen',
  'text_selection',
])

/**
 * Events the server can rate serious: a frame is taken for these when they happen. The server decides
 * which ones really are serious (multiple faces, camera lost, repeated tab switches); the browser only
 * keeps the candidate evidence ready. Few frames are held at once to bound memory.
 */
const PROOF_TYPES = new Set<ExamEventType>([
  'tab_switch',
  'window_blur',
  'multiple_faces',
  'camera_lost',
  'phone_detected',
  'face_mismatch',
  'fullscreen_exit',
  'multi_monitor',
  'devtools_suspected',
  'app_switch_shortcut',
  'no_face',
  'looking_away',
])
const MAX_PENDING_FRAMES = 20

/**
 * Collects proctoring events and sends them in batches of at most 50: every few seconds, and
 * immediately (fetch with `keepalive`) when the page is hidden or closing. The server assigns severity
 * and ignores unknown types; the browser never decides what a violation means, and nothing here stops the exam.
 */
export class EventReporter {
  private queue: ExamEvent[] = []
  /** A frame is taken when the event happens; it is uploaded only if the server rates the event serious. */
  private frames = new WeakMap<ExamEvent, Promise<Blob | null>>()
  private pendingFrames = 0
  private running: Promise<void> | null = null
  private uploads = new Set<Promise<void>>()
  private frameProvider: (() => Promise<Blob | null>) | null = null
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

  /** Where proof frames come from (the camera). Null when there is no camera. */
  setFrameProvider(provider: (() => Promise<Blob | null>) | null) {
    this.frameProvider = provider
  }

  /** `frame` is a frame taken earlier (the start of a spell); it wins over the frame provider. */
  report(
    type: ExamEventType,
    extra: { durationMs?: number; meta?: Record<string, unknown>; frame?: Promise<Blob | null> } = {},
  ) {
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
    if (this.pendingFrames < MAX_PENDING_FRAMES) {
      if (extra.frame) {
        this.frames.set(event, extra.frame.catch(() => null))
        this.pendingFrames += 1
      } else if (this.frameProvider && PROOF_TYPES.has(type)) {
        this.frames.set(event, this.frameProvider().catch(() => null))
        this.pendingFrames += 1
      }
    }
    this.queue.push(event)
    if (this.queue.length > QUEUE_MAX) this.queue.splice(0, this.queue.length - QUEUE_MAX)
    if (this.queue.length >= BATCH_MAX) void this.flush()
  }

  /**
   * `keepalive` lets the request outlive the page; it cannot be awaited reliably, so it is fire-and-forget.
   * `waitForProofs` is for the moment just before submit: the exam must still be running when a proof photo
   * is attached, so wait for the send in progress, send what is queued and wait for every proof upload.
   */
  async flush(keepalive = false, waitForProofs = false) {
    if (waitForProofs) {
      if (this.running) await this.running.catch(() => undefined)
      await this.run(false)
      await Promise.allSettled([...this.uploads])
      return
    }
    const current = this.run(keepalive)
    this.running = current
    try {
      await current
    } finally {
      if (this.running === current) this.running = null
    }
  }

  private async run(keepalive: boolean) {
    if (this.sending && !keepalive) return
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, BATCH_MAX)
      this.sending = true
      try {
        const result = await examApi.events(batch, keepalive)
        this.pendingFrames = Math.max(0, this.pendingFrames - batch.filter((e) => this.frames.has(e)).length)
        // `events` lists every accepted event; an older server only returns `serious`.
        for (const item of result.events ?? result.serious ?? []) {
          const upload = this.uploadProof(batch[item.index], item.event_id)
          this.uploads.add(upload)
          void upload.finally(() => this.uploads.delete(upload))
        }
      } catch (error) {
        // The network or server failed: keep the batch for the next tick. Anything else (the exam is not
        // running, the session ended) cannot succeed later, so the batch is dropped.
        if (isTransient(error) && !this.stopped) {
          this.queue.unshift(...batch)
          if (this.queue.length > QUEUE_MAX) this.queue.length = QUEUE_MAX
        } else if (error instanceof ApiError && error.status === 409) {
          this.queue.length = 0
          this.pendingFrames = 0
        }
        return
      } finally {
        this.sending = false
      }
      if (keepalive) return
    }
  }

  /** Attach the frame taken at the moment of a serious event. Silent on failure, like every proctoring call. */
  private async uploadProof(event: ExamEvent | undefined, eventId: string) {
    const frame = event ? await this.frames.get(event) : null
    if (!frame) return
    try {
      await examApi.snapshot(frame, eventId)
    } catch {
      // rate limited, offline or the exam ended: the proof is best-effort and never disturbs the candidate
    }
  }
}
