import { useEffect, useRef, useState } from 'react'
import type { ExamEventType } from '../types'
import { DevtoolsWatch } from './devtools'
import { remoteDesktopSignals, watchMonitors } from './screenChecks'

type Report = (type: ExamEventType, extra?: { durationMs?: number; meta?: Record<string, unknown> }) => void

const DEVTOOLS_CHECK_MS = 2000
/** Browsers fire several fullscreenchange events for one exit; count and report it once. */
const FULLSCREEN_DEDUPE_MS = 1500

/**
 * Detects what cannot be blocked: leaving the tab or window (with how long), leaving fullscreen,
 * a suspected dev-tools panel and losing the network. Each one is reported; none of them ends the exam.
 * `flushNow` sends queued events at once with `keepalive` when the page is hidden or closing.
 */
export function useDetectors(
  active: boolean,
  report: Report,
  flushNow: () => void,
): { online: boolean; fullscreenExits: number } {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [fullscreenExits, setFullscreenExits] = useState(0)
  const reportRef = useRef(report)
  const flushRef = useRef(flushNow)
  const remoteChecked = useRef(false) // the remote-desktop hint is reported once per attempt
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
    let lastExitAt = -Infinity
    const onFullscreen = () => {
      if (!document.fullscreenEnabled || document.fullscreenElement) return
      const now = performance.now()
      if (now - lastExitAt < FULLSCREEN_DEDUPE_MS) return
      lastExitAt = now
      setFullscreenExits((n) => n + 1)
      rep('fullscreen_exit')
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

    const devtools = new DevtoolsWatch()
    const devtoolsTimer = setInterval(() => {
      try {
        const signals = devtools.check()
        if (signals) rep('devtools_suspected', { meta: { signals } })
      } catch {
        // a failing probe never breaks the exam
      }
    }, DEVTOOLS_CHECK_MS)

    let stopMonitors: () => void = () => undefined
    try {
      stopMonitors = watchMonitors(rep)
    } catch {
      // ignore
    }
    if (!remoteChecked.current) {
      remoteChecked.current = true
      const signals = remoteDesktopSignals()
      if (signals.length > 0) rep('remote_desktop_suspected', { meta: { signals } })
    }

    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      clearInterval(devtoolsTimer)
      stopMonitors()
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [active])

  return { online, fullscreenExits }
}
