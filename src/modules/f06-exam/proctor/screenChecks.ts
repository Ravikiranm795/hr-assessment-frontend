import type { ExamEventType } from '../types'

type Report = (type: ExamEventType, extra?: { durationMs?: number; meta?: Record<string, unknown> }) => void

const MONITOR_POLL_MS = 15_000

interface ExtendedScreen extends Screen {
  isExtended?: boolean
}
interface ScreenDetailsLike {
  screens: unknown[]
}
type WindowWithDetails = Window & { getScreenDetails?: () => Promise<ScreenDetailsLike> }

/** Number of screens when it can be known without prompting: needs `isExtended` or an already granted permission. */
async function screenCount(): Promise<number> {
  const screen = window.screen as ExtendedScreen
  const extended = screen.isExtended === true
  try {
    const win = window as WindowWithDetails
    if (win.getScreenDetails && navigator.permissions) {
      const status = await navigator.permissions.query({ name: 'window-management' as PermissionName })
      if (status.state === 'granted') {
        const details = await win.getScreenDetails()
        return details.screens.length
      }
    }
  } catch {
    // not supported or refused: fall back to isExtended
  }
  return extended ? 2 : 1
}

/** Reports `multi_monitor` once when an extended screen appears. Never prompts for permission. */
export function watchMonitors(report: Report): () => void {
  let reported = false
  let stopped = false
  const check = async () => {
    try {
      const count = await screenCount()
      if (stopped) return
      if (count > 1 && !reported) {
        reported = true
        report('multi_monitor', { meta: { count } })
      } else if (count <= 1) {
        reported = false
      }
    } catch {
      // never disturbs the exam
    }
  }
  void check()
  const timer = setInterval(() => void check(), MONITOR_POLL_MS)
  const screen = window.screen as unknown as EventTarget
  const onChange = () => void check()
  try {
    screen.addEventListener('change', onChange)
  } catch {
    // older browsers
  }
  return () => {
    stopped = true
    clearInterval(timer)
    try {
      screen.removeEventListener('change', onChange)
    } catch {
      // ignore
    }
  }
}

const VM_PATTERN = /microsoft basic render|llvmpipe|vmware|virtualbox|vbox|parallels|swiftshader|qxl|virgl|hyper-v|citrix|xen/i
const REMOTE_UA_PATTERN = /citrix|rdp|teamviewer|anydesk/i

function webglRenderer(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return ''
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '')
  } catch {
    return ''
  }
}

/** Low-confidence hints of a remote desktop or a virtual machine. Empty when nothing stands out. */
export function remoteDesktopSignals(): string[] {
  const signals: string[] = []
  try {
    const renderer = webglRenderer()
    const match = VM_PATTERN.exec(renderer)
    if (match) signals.push(`renderer:${match[0].toLowerCase()}`)
    const ua = REMOTE_UA_PATTERN.exec(navigator.userAgent)
    if (ua) signals.push(`ua:${ua[0].toLowerCase()}`)
    const depth = window.screen.colorDepth
    if (depth && depth < 24) signals.push(`colorDepth:${depth}`)
  } catch {
    // ignore
  }
  return signals
}
