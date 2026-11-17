import { useCallback, useEffect, useRef, useState } from 'react'

const WARN_BEFORE_SEC = 60
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Inactivity timer from `session_timeout_minutes` (spec F-05): warns 60 s before the limit, then fires
 * `onExpire`. Activity before the warning resets the clock; once the warning shows only `stay()` does.
 */
export function useIdleTimeout(timeoutMinutes: number, onExpire: () => void) {
  const last = useRef(0) // set when the timer starts, so render stays pure
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const expire = useRef(onExpire)
  useEffect(() => {
    expire.current = onExpire
  }, [onExpire])

  const stay = useCallback(() => {
    last.current = Date.now()
    setSecondsLeft(null)
  }, [])

  useEffect(() => {
    const limitMs = Math.max(timeoutMinutes, 2) * 60_000
    last.current = Date.now()
    const onActivity = () => {
      if (Date.now() - last.current < limitMs - WARN_BEFORE_SEC * 1000) last.current = Date.now()
    }
    ACTIVITY.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    const timer = window.setInterval(() => {
      const left = Math.ceil((limitMs - (Date.now() - last.current)) / 1000)
      if (left <= 0) expire.current()
      else setSecondsLeft(left <= WARN_BEFORE_SEC ? left : null)
    }, 1000)
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, onActivity))
      window.clearInterval(timer)
    }
  }, [timeoutMinutes])

  return { secondsLeft, stay }
}
