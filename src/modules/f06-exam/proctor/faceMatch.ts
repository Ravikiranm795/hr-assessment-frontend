import type { Embedding, ImageEmbedder } from '@mediapipe/tasks-vision'
import type { ExamEventType } from '../types'
import type { FaceSample } from './faceMonitor'

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/mobilenet_v3_small.tflite'

export const FACE_MATCH_SAMPLE_MS = 5000
/**
 * Cosine similarity below this counts as "a different face". This is a general image embedder, not a face
 * recognition model, so the threshold is deliberately low to keep false positives rare.
 */
export const FACE_MISMATCH_THRESHOLD = 0.55
const MISMATCH_SAMPLES = 5 // consecutive low samples
const MISMATCH_COOLDOWN_MS = 60_000
const CROP_MARGIN = 0.25
const CROP_SIZE = 224
const REFERENCE_MAX_YAW = 0.3 // the reference frame must be facing the camera

type Report = (type: ExamEventType, extra?: { durationMs?: number; meta?: Record<string, unknown> }) => void

let embedderPromise: Promise<ImageEmbedder | null> | null = null
// The library loads on demand; `tick` only runs once an embedder exists, so this is set by then.
let embedderClass: typeof ImageEmbedder | null = null

export function loadFaceEmbedder(): Promise<ImageEmbedder | null> {
  embedderPromise ??= (async () => {
    try {
      const { FilesetResolver, ImageEmbedder } = await import('@mediapipe/tasks-vision')
      embedderClass = ImageEmbedder
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
      return await ImageEmbedder.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
        runningMode: 'IMAGE',
        l2Normalize: true,
      })
    } catch {
      embedderPromise = null
      return null
    }
  })()
  return embedderPromise
}

/** Face region with a margin, scaled to the embedder's input size. */
function cropFace(video: HTMLVideoElement, box: NonNullable<FaceSample['box']>): HTMLCanvasElement | null {
  const mx = box.width * CROP_MARGIN
  const my = box.height * CROP_MARGIN
  const x = Math.max(0, box.x - mx)
  const y = Math.max(0, box.y - my)
  const w = Math.min(video.videoWidth - x, box.width + 2 * mx)
  const h = Math.min(video.videoHeight - y, box.height + 2 * my)
  if (w < 16 || h < 16) return null
  const canvas = document.createElement('canvas')
  canvas.width = CROP_SIZE
  canvas.height = CROP_SIZE
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(video, x, y, w, h, 0, 0, CROP_SIZE, CROP_SIZE)
  return canvas
}

/**
 * Compares the live face with a reference. The baseline photo is stored on the server and the exam page has
 * no way to read it back, so the reference is the first clear single-face frame of the attempt.
 */
export class FaceMatchWatch {
  private reference: Embedding | null = null
  private run = 0
  private last = -Infinity
  private readonly report: Report

  constructor(report: Report) {
    this.report = report
  }

  tick(embedder: ImageEmbedder, video: HTMLVideoElement, sample: FaceSample, now = performance.now()) {
    try {
      if (sample.count !== 1 || !sample.box) return
      // Only frontal faces are used, for the reference and for the checks, to avoid angle-driven false positives.
      if (sample.yaw === null || Math.abs(sample.yaw) > REFERENCE_MAX_YAW) return
      const crop = cropFace(video, sample.box)
      if (!crop) return
      const embedding = embedder.embed(crop).embeddings[0]
      if (!embedding) return
      if (!this.reference) {
        this.reference = embedding
        return
      }
      if (!embedderClass) return
      const similarity = embedderClass.cosineSimilarity(this.reference, embedding)
      this.run = similarity < FACE_MISMATCH_THRESHOLD ? this.run + 1 : 0
      if (this.run >= MISMATCH_SAMPLES && now - this.last >= MISMATCH_COOLDOWN_MS) {
        this.last = now
        this.report('face_mismatch', { meta: { similarity: Math.round(similarity * 100) / 100 } })
      }
    } catch {
      // never disturbs the exam
    }
  }
}
