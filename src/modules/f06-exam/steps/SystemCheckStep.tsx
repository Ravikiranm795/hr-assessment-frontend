import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { HelpPanel } from '../HelpPanel'
import { examApi } from '../examApi'
import { examErrorText, isTerminal } from '../errors'
import { CameraVideo, useCamera } from '../proctor/camera'
import { loadFaceDetector, sampleFaces } from '../proctor/faceMonitor'
import { captureFrame } from '../proctor/snapshots'
import { useFocusOnMount } from '../Screens'
import type { ExamState } from '../types'

const MIN_WIDTH = 900

interface SystemCheckStepProps {
  state: ExamState
  onStarted: () => void
  onFatal: (error: unknown) => void
  onHelpResolved: () => void
}

function CheckItem({ title, done, children }: { title: string; done: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <li className="rounded-(--radius) border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{title}</h2>
        <span className="text-sm text-muted">{t(done ? 'exam.check.done' : 'exam.check.todo')}</span>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </li>
  )
}

export function SystemCheckStep({ state, onStarted, onFatal, onHelpResolved }: SystemCheckStepProps) {
  const { t } = useTranslation()
  const heading = useFocusOnMount<HTMLHeadingElement>()
  const camera = useCamera()
  const cameraNeeded = state.camera_required
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled
  const [photoDone, setPhotoDone] = useState(state.baseline_photo_uploaded)
  const [fullscreenDone, setFullscreenDone] = useState(!fullscreenSupported)
  const [faces, setFaces] = useState<number | null>(null)
  const [busy, setBusy] = useState<'photo' | 'fullscreen' | 'start' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const screenOk = window.innerWidth >= MIN_WIDTH
  const cameraOk = !cameraNeeded || camera.status === 'active'
  const ready = screenOk && cameraOk && (!cameraNeeded || photoDone) && fullscreenDone && !state.help_request_pending

  // The photo button waits until the camera has produced a picture.
  const [frameReady, setFrameReady] = useState(false)
  useEffect(() => {
    if (camera.status !== 'active') return
    const id = setInterval(() => {
      if (video.current && video.current.readyState >= 2 && video.current.videoWidth > 0) {
        setFrameReady(true)
        clearInterval(id)
      }
    }, 200)
    return () => {
      clearInterval(id)
      setFrameReady(false)
    }
  }, [camera.status, camera.stream])

  // A hint only: it never blocks the photo, and it is skipped if the detector cannot load.
  useEffect(() => {
    if (!cameraNeeded || camera.status !== 'active') return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    void loadFaceDetector().then((detector) => {
      if (cancelled || !detector) return
      timer = setInterval(() => {
        const sample = video.current ? sampleFaces(detector, video.current) : null
        if (sample) setFaces(sample.count)
      }, 1000)
    })
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [cameraNeeded, camera.status])

  const takePhoto = async () => {
    if (!video.current) return
    setBusy('photo')
    setError(null)
    try {
      const frame = await captureFrame(video.current, 0.85)
      if (!frame) throw new Error('NO_FRAME')
      await examApi.baselinePhoto(frame)
      setPhotoDone(true)
    } catch (e) {
      setError(e instanceof Error && e.message === 'NO_FRAME' ? t('exam.check.photo.noFrame') : examErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  const testFullscreen = async () => {
    setBusy('fullscreen')
    setError(null)
    try {
      await document.documentElement.requestFullscreen()
      setFullscreenDone(true)
      await document.exitFullscreen()
    } catch {
      // Some browsers refuse. The exam still asks for fullscreen, and carries on without it if it is unavailable.
      setFullscreenDone(true)
    } finally {
      setBusy(null)
    }
  }

  const start = async () => {
    setBusy('start')
    setError(null)
    // Fullscreen needs the click's user gesture, so ask for it before any network call.
    if (document.fullscreenEnabled) void document.documentElement.requestFullscreen().catch(() => undefined)
    try {
      await examApi.systemCheck({
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
        camera_permission: camera.status === 'active',
      })
      await examApi.start()
      onStarted()
    } catch (e) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      if (isTerminal(e)) return onFatal(e)
      setError(examErrorText(e))
      setBusy(null)
    }
  }

  const faceKey = faces === null ? null : faces === 1 ? 'one' : faces === 0 ? 'none' : 'many'

  return (
    <div className="space-y-6">
      <div>
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {t('exam.check.title')}
        </h1>
        <p className="mt-2 text-muted">{t('exam.check.intro')}</p>
      </div>

      <ol className="space-y-4">
        <CheckItem title={t('exam.check.screen.title')} done={screenOk}>
          <p className="text-sm">{t(screenOk ? 'exam.check.screen.ok' : 'exam.check.screen.small', { width: MIN_WIDTH })}</p>
        </CheckItem>

        {cameraNeeded && (
          <CheckItem title={t('exam.check.camera.title')} done={cameraOk}>
            <p className="text-sm">{t('exam.check.camera.body')}</p>
            {camera.status === 'denied' && (
              <p role="alert" className="text-sm text-error">
                {t('exam.check.camera.denied')}
              </p>
            )}
            {camera.status === 'unavailable' && (
              <p role="alert" className="text-sm text-error">
                {t('exam.check.camera.unavailable')}
              </p>
            )}
            {camera.status === 'active' ? (
              <CameraVideo
                stream={camera.stream}
                label={t('exam.check.camera.preview')}
                className="aspect-4/3 w-64 rounded-(--radius) bg-text/10 object-cover"
                videoRef={(el) => {
                  video.current = el
                }}
              />
            ) : (
              <Button loading={camera.status === 'starting'} onClick={() => void camera.request()}>
                {t('exam.check.camera.turnOn')}
              </Button>
            )}
          </CheckItem>
        )}

        {cameraNeeded && (
          <CheckItem title={t('exam.check.photo.title')} done={photoDone}>
            <p className="text-sm">{t('exam.check.photo.body')}</p>
            {faceKey && !photoDone && (
              <p role="status" className="text-sm text-muted">
                {t(`exam.check.face.${faceKey}`)}
              </p>
            )}
            <Button
              variant="outline"
              disabled={camera.status !== 'active' || !frameReady}
              loading={busy === 'photo'}
              onClick={() => void takePhoto()}
            >
              {t(photoDone ? 'exam.check.photo.retake' : 'exam.check.photo.take')}
            </Button>
          </CheckItem>
        )}

        <CheckItem title={t('exam.check.fullscreen.title')} done={fullscreenDone}>
          <p className="text-sm">{t(fullscreenSupported ? 'exam.check.fullscreen.body' : 'exam.check.fullscreen.unsupported')}</p>
          {fullscreenSupported && (
            <Button variant="outline" loading={busy === 'fullscreen'} onClick={() => void testFullscreen()}>
              {t('exam.check.fullscreen.test')}
            </Button>
          )}
        </CheckItem>
      </ol>

      {state.help_request_pending && <p className="text-sm text-muted">{t('exam.check.helpPending')}</p>}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button size="lg" disabled={!ready} loading={busy === 'start'} onClick={() => void start()}>
          {t('exam.check.start')}
        </Button>
        <HelpPanel pending={state.help_request_pending} onResolved={onHelpResolved} />
      </div>
    </div>
  )
}
