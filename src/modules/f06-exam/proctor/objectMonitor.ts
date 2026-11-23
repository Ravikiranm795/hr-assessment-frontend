import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import type { ExamEventType } from '../types'

// Self-hosted, like the face model: no CDN at runtime.
const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/efficientdet_lite0.tflite'

export const OBJECT_SAMPLE_MS = 2000
const PHONE_CATEGORY = 'cell phone'
const PHONE_MIN_SCORE = 0.5
const PHONE_SAMPLES = 2 // consecutive positive samples
const PHONE_COOLDOWN_MS = 30_000

type Report = (type: ExamEventType, extra?: { durationMs?: number; meta?: Record<string, unknown> }) => void

let detectorPromise: Promise<ObjectDetector | null> | null = null

/** Loads the object detector once. Resolves null if it cannot load; the exam carries on without it. */
export function loadObjectDetector(): Promise<ObjectDetector | null> {
  detectorPromise ??= (async () => {
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
      return await ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
        runningMode: 'VIDEO',
        scoreThreshold: 0.3,
        maxResults: 5,
      })
    } catch {
      detectorPromise = null
      return null
    }
  })()
  return detectorPromise
}

/** Best 'cell phone' score on the current frame, or null if none (or the frame is not ready). */
export function samplePhone(detector: ObjectDetector, video: HTMLVideoElement): number | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null
  try {
    const { detections } = detector.detectForVideo(video, performance.now())
    let best = 0
    for (const d of detections) {
      for (const c of d.categories) if (c.categoryName === PHONE_CATEGORY) best = Math.max(best, c.score)
    }
    return best
  } catch {
    return null
  }
}

/** A phone in two samples in a row is one `phone_detected`; then quiet for the cooldown. */
export class ObjectWatch {
  private run = 0
  private last = -Infinity
  private readonly report: Report

  constructor(report: Report) {
    this.report = report
  }

  tick(score: number, now = performance.now()) {
    this.run = score >= PHONE_MIN_SCORE ? this.run + 1 : 0
    if (this.run >= PHONE_SAMPLES && now - this.last >= PHONE_COOLDOWN_MS) {
      this.last = now
      this.report('phone_detected', { meta: { score: Math.round(score * 100) / 100 } })
    }
  }
}
