import { del, get, set } from 'idb-keyval'
import { ApiError } from '@/core/api/errors'
import { examApi } from '../examApi'
import { isSessionLost, isTransient } from '../errors'
import type { AnswerValue } from '../types'

type Outcome = 'ok' | 'retry' | 'dropped' | 'stop'

export interface AnswerSyncHandlers {
  /** The server's remaining seconds, returned by every successful save: the timer re-syncs to it. */
  onRemaining: (seconds: number) => void
  onTimeOver: () => void
  onSubmitted: () => void
  /** Anything that means this link cannot continue (revoked, bound elsewhere). */
  onFatal: (error: unknown) => void
  /** Number of answers not yet confirmed by the server, for the "saved" indicator. */
  onPending: (count: number) => void
}

const DEBOUNCE_TEXT_MS = 800
const DEBOUNCE_CHOICE_MS = 150
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30_000
const FLUSH_TRIES = 4

interface Item {
  answer: AnswerValue
  version: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Autosave: one debounced, idempotent `PUT` per question. Unconfirmed answers are mirrored in IndexedDB so a
 * reload or a crash does not lose them, and are retried with exponential backoff while the connection is down.
 * `flush()` sends everything now (before submit). The server clock keeps running through any of this.
 */
export class AnswerSync {
  private pending = new Map<string, Item>()
  private debounce = new Map<string, ReturnType<typeof setTimeout>>()
  private retry = new Map<string, ReturnType<typeof setTimeout>>()
  private attempts = new Map<string, number>()
  private inflight = new Set<string>()
  private version = 0
  private disposed = false
  private halted = false
  private readonly storeKey: string
  private readonly handlers: AnswerSyncHandlers

  constructor(storeKey: string, handlers: AnswerSyncHandlers) {
    this.storeKey = storeKey
    this.handlers = handlers
  }

  /** Answers saved in this browser but never confirmed (a previous page load); they are newer than the server's. */
  async restore(): Promise<Record<string, AnswerValue>> {
    let saved: Record<string, AnswerValue> | undefined
    try {
      saved = await get<Record<string, AnswerValue>>(this.storeKey)
    } catch {
      saved = undefined
    }
    for (const [questionId, answer] of Object.entries(saved ?? {})) {
      this.pending.set(questionId, { answer, version: ++this.version })
      this.schedule(questionId, 0)
    }
    this.notify()
    return saved ?? {}
  }

  set(questionId: string, answer: AnswerValue, kind: 'text' | 'choice') {
    if (this.disposed) return
    this.pending.set(questionId, { answer, version: ++this.version })
    this.persist()
    this.notify()
    this.schedule(questionId, kind === 'text' ? DEBOUNCE_TEXT_MS : DEBOUNCE_CHOICE_MS)
  }

  /** Send every pending answer now. Resolves true when nothing is left waiting for the server. */
  async flush(): Promise<boolean> {
    for (const timer of [...this.debounce.values(), ...this.retry.values()]) clearTimeout(timer)
    this.debounce.clear()
    this.retry.clear()
    for (let round = 0; round < FLUSH_TRIES && this.pending.size > 0 && !this.halted; round++) {
      if (round > 0) await sleep(Math.min(BACKOFF_BASE_MS * 2 ** round, 4000))
      await Promise.all([...this.pending.keys()].map((id) => this.deliver(id)))
    }
    return this.pending.size === 0
  }

  get pendingCount() {
    return this.pending.size
  }

  dispose() {
    this.disposed = true
    for (const timer of [...this.debounce.values(), ...this.retry.values()]) clearTimeout(timer)
    this.debounce.clear()
    this.retry.clear()
  }

  /** Remove the local copy once the exam is submitted. */
  async clearStore() {
    try {
      await del(this.storeKey)
    } catch {
      // storage unavailable; nothing to clear
    }
  }

  private schedule(questionId: string, delay: number) {
    const existing = this.debounce.get(questionId)
    if (existing) clearTimeout(existing)
    this.debounce.set(
      questionId,
      setTimeout(() => {
        this.debounce.delete(questionId)
        void this.deliverAndRetry(questionId)
      }, delay),
    )
  }

  private async deliverAndRetry(questionId: string) {
    if (this.disposed || this.halted) return
    const outcome = await this.deliver(questionId)
    if (outcome !== 'retry' || this.disposed || this.halted) return
    const tries = (this.attempts.get(questionId) ?? 0) + 1
    this.attempts.set(questionId, tries)
    const wait = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (tries - 1))
    const jitter = Math.random() * wait * 0.25
    this.retry.set(
      questionId,
      setTimeout(() => {
        this.retry.delete(questionId)
        void this.deliverAndRetry(questionId)
      }, wait + jitter),
    )
  }

  /** One save attempt. `retry` means try again later; `ok` and `dropped` mean this question is settled. */
  private async deliver(questionId: string): Promise<Outcome> {
    const item = this.pending.get(questionId)
    if (!item) return 'ok'
    if (this.inflight.has(questionId)) return 'retry'
    this.inflight.add(questionId)
    try {
      const out = await examApi.saveAnswer(questionId, item.answer)
      this.handlers.onRemaining(out.remaining_seconds)
      this.attempts.delete(questionId)
      if (this.pending.get(questionId)?.version === item.version) {
        this.pending.delete(questionId)
        this.persist()
      } else {
        this.schedule(questionId, 0) // changed while saving: send the newer value
      }
      return 'ok'
    } catch (error) {
      return await this.handleError(questionId, error)
    } finally {
      this.inflight.delete(questionId)
      this.notify()
    }
  }

  private async handleError(questionId: string, error: unknown): Promise<Outcome> {
    if (isTransient(error)) return 'retry'
    if (isSessionLost(error)) {
      try {
        await examApi.reopen()
        return 'retry'
      } catch (reopenError) {
        this.halt(reopenError)
        return 'stop'
      }
    }
    if (error instanceof ApiError) {
      if (error.code === 'EXAM_TIME_OVER') {
        this.halted = true
        this.handlers.onTimeOver()
        return 'stop'
      }
      if (error.code === 'EXAM_ALREADY_SUBMITTED' || error.code === 'EXAM_NOT_STARTED') {
        this.halt(null)
        this.handlers.onSubmitted()
        return 'stop'
      }
      if (error.status === 403 || error.status === 410) {
        this.halt(error)
        return 'stop'
      }
      // A 422 (for example every option cleared) can never succeed as it is, so keep the local value and move on.
      this.pending.delete(questionId)
      this.persist()
      return 'dropped'
    }
    return 'retry'
  }

  private halt(error: unknown) {
    this.halted = true
    if (error) this.handlers.onFatal(error)
  }

  private persist() {
    const snapshot: Record<string, AnswerValue> = {}
    for (const [id, item] of this.pending) snapshot[id] = item.answer
    const write = this.pending.size === 0 ? del(this.storeKey) : set(this.storeKey, snapshot)
    write.catch(() => undefined) // IndexedDB can be unavailable (private windows); autosave still works in memory
  }

  private notify() {
    this.handlers.onPending(this.pending.size)
  }
}
