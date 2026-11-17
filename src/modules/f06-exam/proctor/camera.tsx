import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'active' | 'denied' | 'unavailable' | 'lost'

interface CameraValue {
  stream: MediaStream | null
  status: CameraStatus
  /** Ask for the camera (or take it again after it was lost). Resolves true when a live stream exists. */
  request: () => Promise<boolean>
  stop: () => void
  /** Called when the camera track ends mid-exam (unplugged, blocked, taken by another app). */
  onLost: (listener: () => void) => () => void
}

const CameraContext = createContext<CameraValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useCamera() {
  const value = useContext(CameraContext)
  if (!value) throw new Error('useCamera must be used inside CameraProvider')
  return value
}

/**
 * Owns the one camera stream for the whole exam, so the stream survives the move from the system check
 * to the exam and stays on while the preview is hidden (spec F-08). Camera lost never stops the exam (F-09).
 */
export function CameraProvider({ children }: { children: ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const streamRef = useRef<MediaStream | null>(null)
  const listeners = useRef(new Set<() => void>())

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    streamRef.current = null
  }, [])

  const request = useCallback(async () => {
    const current = streamRef.current
    if (current?.getVideoTracks().some((track) => track.readyState === 'live')) return true
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      return false
    }
    release()
    setStatus('starting')
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = next
      next.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setStatus('lost')
          listeners.current.forEach((listener) => listener())
        }
      })
      setStream(next)
      setStatus('active')
      return true
    } catch (error) {
      setStream(null)
      const name = error instanceof DOMException ? error.name : ''
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      return false
    }
  }, [release])

  const stop = useCallback(() => {
    release()
    setStream(null)
    setStatus('idle')
  }, [release])

  const onLost = useCallback((listener: () => void) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  // Release the camera light when the exam page closes.
  useEffect(() => release, [release])

  const value = useMemo(() => ({ stream, status, request, stop, onLost }), [stream, status, request, stop, onLost])
  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
}

interface CameraVideoProps {
  stream: MediaStream | null
  className?: string
  label?: string
  videoRef?: (el: HTMLVideoElement | null) => void
}

/** A muted, inline `<video>` bound to a stream. Used visibly (preview, baseline) and off-screen (monitoring). */
export function CameraVideo({ stream, className, label, videoRef }: CameraVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => undefined)
  }, [stream])
  return (
    <video
      ref={(el) => {
        ref.current = el
        videoRef?.(el)
      }}
      className={className}
      muted
      playsInline
      autoPlay
      aria-label={label}
      aria-hidden={label ? undefined : true}
      tabIndex={-1}
    />
  )
}
