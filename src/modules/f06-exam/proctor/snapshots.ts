import { examApi } from '../examApi'

/** Backend limits: one snapshot per 20 s and 300 per attempt. */
export const MIN_SNAPSHOT_GAP_S = 20
export const MAX_SNAPSHOTS = 300

/** Draw the current video frame to a JPEG; null if the camera has no frame yet. */
export function captureFrame(video: HTMLVideoElement, quality = 0.7): Promise<Blob | null> {
  if (video.readyState < 2 || video.videoWidth === 0) return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 640 / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) return Promise.resolve(null)
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Periodic camera snapshots, throttled to the backend limits. Failures are silent: a missed snapshot
 * must never disturb the candidate or the exam.
 */
export class SnapshotUploader {
  private timer: ReturnType<typeof setInterval> | null = null
  private sent = 0
  private lastAt = -Infinity

  constructor(
    private readonly getVideo: () => HTMLVideoElement | null,
    private readonly intervalSeconds: number,
  ) {}

  start() {
    const seconds = Math.max(this.intervalSeconds, MIN_SNAPSHOT_GAP_S + 1)
    this.timer ??= setInterval(() => void this.tick(), seconds * 1000)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async tick() {
    const video = this.getVideo()
    const now = performance.now()
    if (!video || this.sent >= MAX_SNAPSHOTS || now - this.lastAt < MIN_SNAPSHOT_GAP_S * 1000) return
    const frame = await captureFrame(video)
    if (!frame) return
    this.lastAt = now
    try {
      await examApi.snapshot(frame)
      this.sent += 1
    } catch {
      // rate limited, offline or the exam ended: the next tick tries again within the limits
    }
  }
}
