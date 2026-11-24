import type { FaceDetector } from '@mediapipe/tasks-vision'
import type { ExamEventType } from '../types'

// Everything is self-hosted under /public/mediapipe: no CDN at runtime.
const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/blaze_face_short_range.tflite'

const MIN_SPELL_MS = 3000 // no face or looking away must last this long before it counts
const MULTI_SAMPLES = 2 // two faces in two samples in a row
const INTERIM_MS = 30_000 // a long spell is reported in pieces so nothing is lost if the page closes
const MULTI_COOLDOWN_MS = 20_000
const YAW_LIMIT = 0.45 // nose offset from the eye midpoint, relative to the eye distance

export interface FaceSample {
  count: number
  /** Horizontal head turn estimate for a single face; null when there is not exactly one face. */
  yaw: number | null
  /** Face bounding box in video pixels for a single face; used to crop for the identity check. */
  box?: { x: number; y: number; width: number; height: number }
}

let detectorPromise: Promise<FaceDetector | null> | null = null

/** Loads BlazeFace once. Resolves null if it cannot load; the camera and snapshots still work without it. */
export function loadFaceDetector(): Promise<FaceDetector | null> {
  detectorPromise ??= (async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
      return await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      })
    } catch {
      detectorPromise = null
      return null
    }
  })()
  return detectorPromise
}

export function sampleFaces(detector: FaceDetector, video: HTMLVideoElement): FaceSample | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null
  try {
    const { detections } = detector.detectForVideo(video, performance.now())
    if (detections.length !== 1) return { count: detections.length, yaw: null }
    const bb = detections[0].boundingBox
    const box = bb ? { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height } : undefined
    const [rightEye, leftEye, nose] = detections[0].keypoints ?? []
    if (!rightEye || !leftEye || !nose) return { count: 1, yaw: null, box }
    const eyeDistance = Math.abs(leftEye.x - rightEye.x)
    if (eyeDistance < 0.01) return { count: 1, yaw: null, box }
    return { count: 1, yaw: (nose.x - (rightEye.x + leftEye.x) / 2) / eyeDistance, box }
  } catch {
    return null
  }
}

type Report = (
  type: ExamEventType,
  extra?: { durationMs?: number; meta?: Record<string, unknown>; frame?: Promise<Blob | null> },
) => void
type CaptureNow = () => Promise<Blob | null>

/** A condition that must hold for a while before it counts, reported with its duration. */
class Spell {
  private startedAt: number | null = null
  private reportedUntil = 0
  private frame: Promise<Blob | null> | undefined
  private readonly type: ExamEventType
  private readonly report: Report
  private readonly captureNow?: CaptureNow

  constructor(type: ExamEventType, report: Report, captureNow?: CaptureNow) {
    this.type = type
    this.report = report
    this.captureNow = captureNow
  }

  update(on: boolean, now: number) {
    if (on) {
      if (this.startedAt === null) {
        this.startedAt = now
        // The proof is the moment it began: by the time 3 s have passed the person may be back.
        this.frame = this.captureNow?.().catch(() => null)
      }
      const from = Math.max(this.startedAt, this.reportedUntil)
      if (now - this.startedAt >= MIN_SPELL_MS && now - from >= INTERIM_MS) this.emit(now, true)
    } else {
      this.end(now)
    }
  }

  end(now: number) {
    if (this.startedAt !== null) {
      const from = Math.max(this.startedAt, this.reportedUntil)
      const qualifies = now - this.startedAt >= MIN_SPELL_MS
      if (qualifies && (this.reportedUntil === 0 || now - from >= MIN_SPELL_MS)) this.emit(now, false)
    }
    this.startedAt = null
    this.reportedUntil = 0
    this.frame = undefined
  }

  private emit(now: number, stillOn: boolean) {
    const from = Math.max(this.startedAt ?? now, this.reportedUntil)
    // First piece: the start frame. Later pieces: a fresh frame while the condition still holds; when the
    // spell has just ended there is nothing fresh to show, so the previous piece's frame is reused.
    if (this.reportedUntil !== 0 && stillOn && this.captureNow) this.frame = this.captureNow().catch(() => null)
    this.report(this.type, { durationMs: now - from, ...(this.frame ? { frame: this.frame } : {}) })
    this.reportedUntil = now
  }
}

/** Turns face samples into events: no face, multiple faces, looking away. Never blocks or judges anything. */
export class FaceWatch {
  private readonly noFace: Spell
  private readonly away: Spell
  private multiRun = 0
  private lastMulti = -Infinity
  private readonly report: Report

  constructor(report: Report, captureNow?: CaptureNow) {
    this.report = report
    this.noFace = new Spell('no_face', report, captureNow)
    this.away = new Spell('looking_away', report, captureNow)
  }

  tick(sample: FaceSample, now = performance.now()) {
    this.noFace.update(sample.count === 0, now)
    this.away.update(sample.yaw !== null && Math.abs(sample.yaw) > YAW_LIMIT, now)
    this.multiRun = sample.count >= 2 ? this.multiRun + 1 : 0
    if (this.multiRun >= MULTI_SAMPLES && now - this.lastMulti >= MULTI_COOLDOWN_MS) {
      this.lastMulti = now
      this.report('multiple_faces', { meta: { count: sample.count } })
    }
  }

  /** Close any open spell so a submit in the middle of one still reports it. */
  finish(now = performance.now()) {
    this.noFace.end(now)
    this.away.end(now)
  }
}
