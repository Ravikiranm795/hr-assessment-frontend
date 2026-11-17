import { useEffect, useRef, useState } from 'react'
import type { ExamEventType } from '../types'

type Report = (type: ExamEventType, extra?: { durationMs?: number; meta?: Record<string, unknown> }) => void

const DEVTOOLS_CHECK_MS = 2000
// A docked dev-tools panel shrinks the page against the window. Normal browser chrome is about 80-140 px
// tall, so the windowed thresholds are large; in fullscreen any gap at all is suspicious.
const WINDOWED_W = 200
const WINDOWED_H = 360
const FULLSCREEN_GAP = 100

function devtoolsLikelyOpen() {
  const dw = window.outerWidth - window.innerWidth
  const dh = window.outerHeight - window.innerHeight
  if (document.fullscreenElement) return dw > FULLSCREEN_GAP || dh > FULLSCREEN_GAP
  return dw > WINDOWED_W || dh > WINDOWED_H
}

/**
 * Detects what cannot be blocked: leaving the tab or window (with how long), leaving fullscreen,
 * a suspected dev-tools panel and losing the network. Each one is reported; none of them ends the exam.
 * `flushNow` sends queued events at once with `keepalive` when the page is hidden or closing.
 */
export function useDetectors(active: boolean, report: Report, flushNow: () => void): { online: boolean } {
  const [online, setOnline] = useState(() => navigator.onLine)
  const reportRef = useRef(report)
  const flushRef = useRef(flushNow)
  useEffect(() => {
    reportRef.current = report
    flushRef.current = flushNow
  })

  useEffect(() => {
    if (!active) return
    const rep: Report = (type, extra) => reportRef.current(type, extra)
    let hiddenAt: number | null = null
    let blurAt: number | null = null
    let tabReported = false // a tab switch already covers the blur that came with it

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = performance.now()
        flushRef.current()
      } else if (hiddenAt !== null) {
        rep('tab_switch', { durationMs: performance.now() - hiddenAt })
        hiddenAt = null
        tabReported = true
      }
    }
    const onBlur = () => {
      blurAt = performance.now()
      tabReported = false
    }
    const onFocus = () => {
      if (blurAt !== null && !tabReported) rep('window_blur', { durationMs: performance.now() - blurAt })
      blurAt = null
      tabReported = false
    }
    const onFullscreen = () => {
      if (document.fullscreenEnabled && !document.fullscreenElement) rep('fullscreen_exit')
    }
    let offlineAt: number | null = null
    const onOffline = () => {
      offlineAt = performance.now()
      setOnline(false)
    }
    const onOnline = () => {
      if (offlineAt !== null) rep('offline', { durationMs: performance.now() - offlineAt })
      offlineAt = null
      setOnline(true)
    }
    const onPageHide = () => flushRef.current()

    let devtoolsOpen = false
    const devtoolsTimer = setInterval(() => {
      const open = devtoolsLikelyOpen()
      if (open && !devtoolsOpen) rep('devtools_suspected')
      devtoolsOpen = open
    }, DEVTOOLS_CHECK_MS)

    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      clearInterval(devtoolsTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [active])

  return { online }
}
