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

/** A non-editable selection at least this long is reported (selectstart already blocks most selections). */
const SELECTION_MIN_CHARS = 20

/** Keys that switch window, tab or app, or close the window. Returns true when the browser may let us block it. */
function appSwitchKind(e: KeyboardEvent): 'meta' | 'combo' | null {
  if (e.key === 'Meta' || e.key === 'OS') return 'meta'
  const key = e.key.toLowerCase()
  if (e.altKey && ['tab', 'escape', 'f4'].includes(key)) return 'combo'
  if (e.metaKey && key === 'tab') return 'combo'
  if (e.ctrlKey && ['tab', 'w', 'n', 't'].includes(key)) return 'combo'
  return null
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
          try {
            if (e.key === 'PrintScreen') return onPrintScreen(e)
            const kind = e.repeat ? null : appSwitchKind(e)
            if (kind) {
              if (kind === 'combo') e.preventDefault() // the browser or OS may still win; the attempt is reported
              reportRef.current('app_switch_shortcut', { meta: { key: e.key } })
              return
            }
          } catch {
            // a failing detector never breaks the exam
          }
          if (isBlockedShortcut(e)) block(e, 'devtools_shortcut')
        },
      ],
      ['keyup', (e: KeyboardEvent) => e.key === 'PrintScreen' && onPrintScreen(e)],
    ]
    const onPrintScreen = (e: KeyboardEvent) => {
      try {
        reportRef.current('print_screen')
        void navigator.clipboard?.writeText('').catch(() => undefined) // best effort: clears a captured image
        if (e.type === 'keydown') e.preventDefault()
      } catch {
        // ignore
      }
    }
    // `selectstart` blocks selecting; a selection that still happens (programmatic, drag from an input) is reported.
    const onSelectionChange = () => {
      try {
        const selection = document.getSelection()
        if (!selection || selection.isCollapsed) return
        const anchor = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement
        if (isEditable(anchor ?? null) || isEditable(document.activeElement)) return
        const length = selection.toString().length
        if (length >= SELECTION_MIN_CHARS) reportRef.current('text_selection', { meta: { length } })
      } catch {
        // ignore
      }
    }
    document.addEventListener('selectionchange', onSelectionChange)
    for (const [name, fn] of handlers) document.addEventListener(name, fn as EventListener, true)

    // Reload, back and close ask for confirmation. Browsers show their own text.
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      for (const [name, fn] of handlers) document.removeEventListener(name, fn as EventListener, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      window.removeEventListener('beforeunload', warn)
    }
  }, [active])
}
