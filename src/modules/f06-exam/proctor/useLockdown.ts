import { useEffect, useRef } from 'react'
import type { ExamEventType } from '../types'

type Report = (type: ExamEventType, extra?: { meta?: Record<string, unknown> }) => void

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

/** True for the dev-tools, view-source, print and save shortcuts (spec F6 lockdown). */
function isBlockedShortcut(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase()
  if (e.key === 'F12') return true
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return false
  if (e.shiftKey && ['i', 'j', 'c'].includes(key)) return true // Ctrl+Shift+I / J / C
  if (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(key)) return true // macOS Cmd+Option+I / J / C / U
  return ['u', 'p', 's'].includes(key) // view source, print, save
}

/**
 * Blocks what a browser lets a page block and reports each attempt as an event. Nothing here ends the
 * exam: the candidate can always carry on. Reload and back are covered by the `beforeunload` warning.
 */
export function useLockdown(active: boolean, report: Report, onBlocked: () => void) {
  const reportRef = useRef(report)
  const blockedRef = useRef(onBlocked)
  useEffect(() => {
    reportRef.current = report
    blockedRef.current = onBlocked
  })

  useEffect(() => {
    if (!active) return
    const block = (e: Event, type?: ExamEventType) => {
      e.preventDefault()
      if (type) reportRef.current(type)
      blockedRef.current()
    }
    const handlers: Array<[keyof DocumentEventMap, (e: never) => void]> = [
      ['contextmenu', (e: Event) => block(e, 'context_menu')],
      ['copy', (e: Event) => block(e, 'copy_attempt')],
      ['cut', (e: Event) => block(e, 'cut_attempt')],
      ['paste', (e: Event) => block(e, 'paste_attempt')],
      ['dragstart', (e: Event) => e.preventDefault()],
      ['drop', (e: Event) => e.preventDefault()],
      ['selectstart', (e: Event) => !isEditable(e.target) && e.preventDefault()],
      [
        'keydown',
        (e: KeyboardEvent) => {
          if (isBlockedShortcut(e)) block(e, 'devtools_shortcut')
        },
      ],
    ]
    for (const [name, fn] of handlers) document.addEventListener(name, fn as EventListener, true)

    // Reload, back and close ask for confirmation. Browsers show their own text.
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      for (const [name, fn] of handlers) document.removeEventListener(name, fn as EventListener, true)
      window.removeEventListener('beforeunload', warn)
    }
  }, [active])
}
