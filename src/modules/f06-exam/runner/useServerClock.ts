import { useCallback, useEffect, useState } from 'react'

interface Base {
  remaining: number
  at: number
}

/**
 * Countdown driven by the server (spec F-11). `sync(seconds)` re-bases the clock on a value from the
 * server (state, questions, heartbeat or an answer save); between syncs it ticks locally using the
 * monotonic `performance.now()`, never the wall clock, so changing the computer's time changes nothing.
 */
export function useServerClock(initial: number | null) {
  const [base, setBase] = useState<Base | null>(() =>
    initial === null ? null : { remaining: initial, at: performance.now() },
  )
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [])

  const sync = useCallback((seconds: number) => setBase({ remaining: seconds, at: performance.now() }), [])
  const left = base === null ? null : Math.max(0, Math.ceil(base.remaining - (performance.now() - base.at) / 1000))
  return { left, sync }
}

export function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}
