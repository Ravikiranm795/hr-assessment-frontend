import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from '../proctor/camera'
import { EventReporter } from '../proctor/eventReporter'
import type { ImageEmbedder } from '@mediapipe/tasks-vision'
import { FACE_MATCH_SAMPLE_MS, FaceMatchWatch, loadFaceEmbedder } from '../proctor/faceMatch'
import { FaceWatch, loadFaceDetector, sampleFaces } from '../proctor/faceMonitor'
import { OBJECT_SAMPLE_MS, ObjectWatch, loadObjectDetector, samplePhone } from '../proctor/objectMonitor'
import { SnapshotUploader, captureFrame } from '../proctor/snapshots'
import { useDetectors } from '../proctor/useDetectors'
import { useLockdown } from '../proctor/useLockdown'
import type { ExamEventType } from '../types'

const FACE_SAMPLE_MS = 1000
const NOTE_MS = 3000

interface Options {
  /** True while the exam is running and the candidate can still answer. */
  active: boolean
  cameraRequired: boolean
  snapshotIntervalSeconds?: number | null
  /** The page was reloaded while the exam was in progress. */
  resumed: boolean
}

/**
 * Everything that watches the exam: lockdown, detectors, the event queue, face detection and snapshots.
 * It only records and reports. It never ends the exam and nothing it learns is shown to the candidate.
 */
export function useProctoring({ active, cameraRequired, snapshotIntervalSeconds, resumed }: Options) {
  const camera = useCamera()
  const reporter = useRef<EventReporter | null>(null)
  reporter.current ??= new EventReporter()
  const monitorVideo = useRef<HTMLVideoElement | null>(null)
  const faceWatch = useRef<FaceWatch | null>(null)
  const [blockedNote, setBlockedNote] = useState(false)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const report = useCallback(
    (type: ExamEventType, extra?: { durationMs?: number; meta?: Record<string, unknown> }) =>
      reporter.current?.report(type, extra),
    [],
  )
  const flushNow = useCallback(() => void reporter.current?.flush(true), [])

  useEffect(() => {
    const current = reporter.current
    if (!active || !current) return
    current.start()
    return () => current.stop()
  }, [active])

  useEffect(() => {
    if (active && resumed) report('page_reload')
  }, [active, resumed, report])

  const onBlocked = useCallback(() => {
    setBlockedNote(true)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setBlockedNote(false), NOTE_MS)
  }, [])
  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current)
    },
    [],
  )

  useLockdown(active, report, onBlocked)
  const { online, fullscreenExits } = useDetectors(active, report, flushNow)

  // Camera lost is an event, and the page shows a banner; the exam keeps running (F-09).
  useEffect(() => {
    if (!active || !cameraRequired) return
    return camera.onLost(() => report('camera_lost'))
  }, [active, cameraRequired, camera, report])

  // Face detection runs on a hidden video, so hiding the preview never stops it (F-08).
  const stream = camera.stream
  useEffect(() => {
    if (!active || !cameraRequired || !stream) return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    const watch = new FaceWatch((type, extra) => report(type, extra))
    faceWatch.current = watch
    const match = new FaceMatchWatch((type, extra) => report(type, extra))
    let embedder: ImageEmbedder | null = null
    void loadFaceEmbedder().then((e) => {
      embedder = e
    })
    let ticks = 0
    const matchEvery = Math.round(FACE_MATCH_SAMPLE_MS / FACE_SAMPLE_MS)
    void loadFaceDetector().then((detector) => {
      if (cancelled || !detector) return
      timer = setInterval(() => {
        const video = monitorVideo.current
        const sample = video ? sampleFaces(detector, video) : null
        if (sample) watch.tick(sample)
        ticks += 1
        if (video && sample && embedder && ticks % matchEvery === 0) match.tick(embedder, video, sample)
      }, FACE_SAMPLE_MS)
    })
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      watch.finish()
      faceWatch.current = null
    }
  }, [active, cameraRequired, stream, report])

  // Phone detection: lazy model, sampled on the same hidden video. A load failure is silent.
  useEffect(() => {
    if (!active || !cameraRequired || !stream) return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    const watch = new ObjectWatch((type, extra) => report(type, extra))
    void loadObjectDetector().then((detector) => {
      if (cancelled || !detector) return
      timer = setInterval(() => {
        const video = monitorVideo.current
        const score = video ? samplePhone(detector, video) : null
        if (score !== null) watch.tick(score)
      }, OBJECT_SAMPLE_MS)
    })
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [active, cameraRequired, stream, report])

  useEffect(() => {
    if (!active || !cameraRequired || !stream) return
    const uploader = new SnapshotUploader(() => monitorVideo.current, snapshotIntervalSeconds)
    uploader.start()
    return () => uploader.stop()
  }, [active, cameraRequired, stream, snapshotIntervalSeconds])

  // Proof photos for serious violations: the reporter grabs a frame when an event happens.
  useEffect(() => {
    const current = reporter.current
    if (!active || !cameraRequired || !stream || !current) return
    current.setFrameProvider(() => {
      const video = monitorVideo.current
      return video ? captureFrame(video) : Promise.resolve(null)
    })
    return () => current.setFrameProvider(null)
  }, [active, cameraRequired, stream])

  const setMonitorVideo = useCallback((el: HTMLVideoElement | null) => {
    monitorVideo.current = el
  }, [])

  /** Close open spells and send what is queued; call just before submitting. */
  const finish = useCallback(async () => {
    faceWatch.current?.finish()
    await reporter.current?.flush()
  }, [])

  return { report, online, fullscreenExits, blockedNote, setMonitorVideo, finish }
}
