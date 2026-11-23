// A docked dev-tools panel shrinks the page against the window. Normal browser chrome is about 80-140 px
// tall, so the windowed thresholds are large; in fullscreen any gap at all is suspicious.
const WINDOWED_W = 200
const WINDOWED_H = 360
const FULLSCREEN_GAP = 100
/** console.table is slow to format while the console is open; closed it is nearly free. */
const TIMING_LIMIT_MS = 40
const TIMING_ROWS = Array.from({ length: 40 }, (_, i) => ({ a: i, b: String(i), c: [i] }))

function sizeSignal(): boolean {
  const dw = window.outerWidth - window.innerWidth
  const dh = window.outerHeight - window.innerHeight
  if (document.fullscreenElement) return dw > FULLSCREEN_GAP || dh > FULLSCREEN_GAP
  return dw > WINDOWED_W || dh > WINDOWED_H
}

/** Browsers read an element's `id` lazily only when the console is open and formatting it. */
function getterSignal(): boolean {
  let read = false
  const probe = document.createElement('div')
  Object.defineProperty(probe, 'id', {
    get() {
      read = true
      return ''
    },
  })
  console.debug(probe)
  return read
}

function timingSignal(): boolean {
  const start = performance.now()
  console.table(TIMING_ROWS)
  const elapsed = performance.now() - start
  console.clear()
  return elapsed > TIMING_LIMIT_MS
}

/** Which signals fire right now. Any failure counts as no signal; the exam is never affected. */
export function devtoolsSignals(): string[] {
  const out: string[] = []
  try {
    if (sizeSignal()) out.push('size')
  } catch {
    // ignore
  }
  try {
    if (getterSignal()) out.push('getter')
  } catch {
    // ignore
  }
  try {
    if (timingSignal()) out.push('timing')
  } catch {
    // ignore
  }
  return out
}

/** Reports once per opening, after two positive checks in a row to cut false positives. */
export class DevtoolsWatch {
  private streak = 0
  private open = false

  /** Returns the signals when a new opening is confirmed, otherwise null. */
  check(): string[] | null {
    const signals = devtoolsSignals()
    if (signals.length === 0) {
      this.streak = 0
      this.open = false
      return null
    }
    this.streak += 1
    if (this.streak >= 2 && !this.open) {
      this.open = true
      return signals
    }
    return null
  }
}
